"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TestType = "cat" | "kasus" | "wawancara";

type CompetencyTest = {
  id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  test_type: TestType;
  is_active: boolean;
  question_count?: number;
};

type FormData = {
  name: string;
  description: string;
  duration_minutes: string;
  passing_score: string;
  test_type: TestType;
  is_active: boolean;
};

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  duration_minutes: "120",
  passing_score: "70",
  test_type: "cat",
  is_active: true,
};

function typeLabel(type: TestType) {
  if (type === "cat") return "Uji CAT";
  if (type === "kasus") return "Uji Kasus";
  return "Uji Wawancara";
}

function typeBadge(type: TestType) {
  if (type === "cat") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }
  if (type === "kasus") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-purple-50 text-purple-700 ring-purple-200";
}

export default function CompetencyTestsPage() {
  const [tests, setTests] = useState<CompetencyTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TestType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const loadTests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("competency_tests")
        .select(
          "id, name, description, duration_minutes, passing_score, test_type, is_active"
        )
        .order("id", { ascending: false });

      if (queryError) throw queryError;

      const rows = (data ?? []) as CompetencyTest[];

      // Hitung jumlah soal aktif per uji. Kegagalan hitungan tidak
      // menghilangkan data uji kompetensi dari halaman.
      const withCounts = await Promise.all(
        rows.map(async (test) => {
          const { count } = await supabase
            .from("question_bank")
            .select("id", { count: "exact", head: true })
            .eq("competency_test_id", test.id)
            .eq("is_active", true);

          return {
            ...test,
            id: Number(test.id),
            duration_minutes: Number(test.duration_minutes) || 0,
            passing_score: Number(test.passing_score) || 0,
            question_count: count ?? 0,
          };
        })
      );

      setTests(withCounts);
    } catch (err) {
      console.error("LOAD COMPETENCY TESTS:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Data uji kompetensi gagal dimuat."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  const filteredTests = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return tests.filter((test) => {
      const matchesSearch =
        !keyword ||
        test.name.toLowerCase().includes(keyword) ||
        (test.description ?? "").toLowerCase().includes(keyword);

      const matchesType =
        typeFilter === "all" || test.test_type === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && test.is_active) ||
        (statusFilter === "inactive" && !test.is_active);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [tests, search, typeFilter, statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (test: CompetencyTest) => {
    setEditingId(test.id);
    setForm({
      name: test.name,
      description: test.description ?? "",
      duration_minutes: String(test.duration_minutes),
      passing_score: String(test.passing_score),
      test_type: test.test_type,
      is_active: test.is_active,
    });
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    const duration = Number(form.duration_minutes);
    const passing = Number(form.passing_score);

    if (!name) {
      setError("Nama uji kompetensi wajib diisi.");
      return;
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Durasi harus lebih besar dari 0 menit.");
      return;
    }

    if (!Number.isFinite(passing) || passing < 0 || passing > 100) {
      setError("Passing grade harus berada di antara 0 sampai 100.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name,
        description: form.description.trim() || null,
        duration_minutes: Math.round(duration),
        passing_score: passing,
        test_type: form.test_type,
        is_active: form.is_active,
      };

      if (editingId !== null) {
        const { error: updateError } = await supabase
          .from("competency_tests")
          .update(payload)
          .eq("id", editingId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("competency_tests")
          .insert(payload);

        if (insertError) throw insertError;
      }

      closeModal();
      await loadTests();
    } catch (err) {
      console.error("SAVE COMPETENCY TEST:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Uji kompetensi gagal disimpan."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (test: CompetencyTest) => {
    const nextStatus = !test.is_active;

    try {
      setError("");

      const { error: updateError } = await supabase
        .from("competency_tests")
        .update({ is_active: nextStatus })
        .eq("id", test.id);

      if (updateError) throw updateError;

      setTests((current) =>
        current.map((item) =>
          item.id === test.id
            ? { ...item, is_active: nextStatus }
            : item
        )
      );
    } catch (err) {
      console.error("TOGGLE COMPETENCY TEST:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Status uji kompetensi gagal diubah."
      );
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 text-sm font-semibold text-blue-600">
              UJI KOMPETENSI
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Uji Kompetensi
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Kelola CAT, Uji Kasus, dan Uji Wawancara LSP-PDN Kemendagri.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            + Tambah Uji Kompetensi
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total Uji
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {tests.length}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Uji Aktif
            </div>
            <div className="mt-2 text-3xl font-bold text-emerald-600">
              {tests.filter((test) => test.is_active).length}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Uji CAT
            </div>
            <div className="mt-2 text-3xl font-bold text-blue-600">
              {tests.filter((test) => test.test_type === "cat").length}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Terjadi kesalahan:</strong> {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama uji kompetensi..."
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as "all" | TestType)
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">Semua Jenis</option>
                <option value="cat">Uji CAT</option>
                <option value="kasus">Uji Kasus</option>
                <option value="wawancara">Uji Wawancara</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | "active" | "inactive"
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Memuat data uji kompetensi...
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl">📋</div>
              <h2 className="mt-3 font-bold text-slate-900">
                Belum ada data
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tambahkan uji kompetensi pertama untuk mulai mengelola ujian.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">No</th>
                    <th className="px-5 py-4">Uji Kompetensi</th>
                    <th className="px-5 py-4">Jenis</th>
                    <th className="px-5 py-4">Soal</th>
                    <th className="px-5 py-4">Durasi</th>
                    <th className="px-5 py-4">Passing Grade</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTests.map((test, index) => (
                    <tr key={test.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4 text-slate-500">
                        {index + 1}
                      </td>
                      <td className="min-w-[280px] px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {test.name}
                        </div>
                        {test.description && (
                          <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {test.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${typeBadge(
                            test.test_type
                          )}`}
                        >
                          {typeLabel(test.test_type)}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {test.question_count ?? 0}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {test.duration_minutes} menit
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {test.passing_score}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            test.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {test.is_active ? "Aktif" : "Tidak Aktif"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(test)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(test)}
                            className={`rounded-lg px-3 py-2 text-xs font-bold ${
                              test.is_active
                                ? "border border-red-200 text-red-600 hover:bg-red-50"
                                : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {test.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId === null
                    ? "Tambah Uji Kompetensi"
                    : "Edit Uji Kompetensi"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Data ini menjadi dasar untuk penjadwalan dan pelaksanaan ujian.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nama Uji Kompetensi *
                </label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Sertifikasi Kompetensi ASN Tahun 2026"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Deskripsi
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Deskripsi singkat uji kompetensi..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Jenis Ujian *
                  </label>
                  <select
                    value={form.test_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        test_type: event.target.value as TestType,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="cat">Uji CAT</option>
                    <option value="kasus">Uji Kasus</option>
                    <option value="wawancara">Uji Wawancara</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Durasi (menit) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.duration_minutes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        duration_minutes: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Passing Grade *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.passing_score}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        passing_score: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Uji kompetensi aktif
                  </span>
                  <span className="block text-xs text-slate-500">
                    Uji aktif dapat digunakan untuk pembuatan jadwal.
                  </span>
                </span>
              </label>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan Uji Kompetensi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
