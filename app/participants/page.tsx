"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Participant = {
  id: number;
  full_name: string;
  nip: string | null;
  pangkat_golongan: string | null;
  jabatan: string | null;
  instansi: string | null;
  unit_kerja: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

type ParticipantForm = {
  full_name: string;
  nip: string;
  pangkat_golongan: string;
  jabatan: string;
  instansi: string;
  unit_kerja: string;
  email: string;
  phone: string;
};

type PangkatGolongan = {
  id: number;
  golongan: string;
  pangkat_golongan: string;
};

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [loading, setLoading] = useState(true);
  const [pangkatGolonganList, setPangkatGolonganList] = useState<
    PangkatGolongan[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);

  const emptyForm: ParticipantForm = {
    full_name: "",
    nip: "",
    pangkat_golongan: "",
    jabatan: "",
    instansi: "",
    unit_kerja: "",
    email: "",
    phone: "",
  };

  const [form, setForm] = useState<ParticipantForm>(emptyForm);
  const [editForm, setEditForm] =
    useState<ParticipantForm>(emptyForm);

  useEffect(() => {
    loadParticipants();
  }, []);

  // =====================================================
  // LOAD PARTICIPANTS
  // =====================================================

  async function loadParticipants() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("AUTH ERROR:", authError);
        setError("Sesi login tidak valid.");
        return;
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      // =================================================
      // LOAD MASTER PANGKAT / GOLONGAN
      // =================================================

      const { data: pangkatData, error: pangkatError } = await supabase
  .from("master_pangkat_golongan")
  .select("id, golongan, pangkat_golongan")
  .order("id", { ascending: true });

console.log("DATA PANGKAT/GOLONGAN:", pangkatData);
console.log("ERROR PANGKAT/GOLONGAN:", pangkatError);

if (pangkatError) {
  throw pangkatError;
}

setPangkatGolonganList(pangkatData ?? []);

      // =================================================
      // LOAD PARTICIPANTS
      // =================================================

      const {
        data,
        error: participantError,
      } = await supabase
        .from("participants")
        .select(`
          id,
          full_name,
          nip,
          pangkat_golongan,
          jabatan,
          instansi,
          unit_kerja,
          email,
          phone,
          is_active,
          created_at,
          updated_at,
          user_id
        `)
        .order("created_at", {
          ascending: false,
        });

      if (participantError) {
        console.error(
          "GAGAL MENGAMBIL PESERTA:",
          participantError
        );

        setError(
          `Gagal mengambil data peserta: ${participantError.message}`
        );

        return;
      }

      setParticipants(
        (data || []) as Participant[]
      );
    } catch (err) {
      console.error(
        "Participants error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data peserta."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // RESET FORM
  // =====================================================

  function resetForm() {
    setForm(emptyForm);
  }

  function closeAddModal() {
    if (saving) return;

    setShowModal(false);
    resetForm();
  }

  function closeEditModal() {
    if (saving) return;

    setShowEditModal(false);
    setSelectedParticipant(null);
  }

  // =====================================================
  // CREATE PARTICIPANT
  // =====================================================

  async function handleCreateParticipant() {
  try {
    setSaving(true);
    setError("");

    // ===================================================
    // VALIDASI
    // ===================================================

    if (!form.full_name.trim()) {
      alert("Nama lengkap wajib diisi.");
      return;
    }

    if (!form.nip.trim()) {
      alert(
        "NIP wajib diisi untuk membuat akun login peserta."
      );
      return;
    }

    if (!form.email.trim()) {
      alert(
        "Email wajib diisi untuk membuat akun login peserta."
      );
      return;
    }

    // ===================================================
    // AMBIL SESSION LOGIN ADMIN
    // ===================================================

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert(
        "Sesi login Anda sudah berakhir. Silakan login kembali."
      );

      window.location.href = "/login";
      return;
    }

    // ===================================================
    // BUAT PESERTA + AKUN AUTH
    // ===================================================

    const response = await fetch(
      "/api/participants/create-account",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name:
            form.full_name.trim(),

          nip:
            form.nip.trim(),

          pangkat_golongan:
            form.pangkat_golongan.trim(),

          jabatan:
            form.jabatan.trim(),

          instansi:
            form.instansi.trim(),

          unit_kerja:
            form.unit_kerja.trim(),

          email:
            form.email.trim(),

          phone:
            form.phone.trim(),
        }),
      }
    );

    const result =
      await response.json();

    // ===================================================
    // ERROR
    // ===================================================

    if (!response.ok || !result.success) {
      console.error(
        "CREATE PARTICIPANT ACCOUNT ERROR:",
        result
      );

      alert(
        result.message ||
          "Gagal membuat peserta dan akun login."
      );

      return;
    }

    // ===================================================
    // BERHASIL
    // ===================================================

    const credentials =
      result.credentials;

    setShowModal(false);
    resetForm();

    await loadParticipants();

    // ===================================================
    // TAMPILKAN KREDENSIAL
    // ===================================================

    alert(
      `Peserta berhasil ditambahkan!

Nama: ${credentials.full_name}
NIP: ${credentials.nip}
Email: ${credentials.email}
Password: ${credentials.password}

Simpan password ini untuk diberikan kepada peserta.`
    );
  } catch (err) {
    console.error(
      "Create participant error:",
      err
    );

    alert(
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menambahkan peserta."
    );
  } finally {
    setSaving(false);
  }
}

  function handleEdit(
    participant: Participant
  ) {
    setSelectedParticipant(participant);

    setEditForm({
      full_name:
        participant.full_name || "",
      nip:
        participant.nip || "",
      pangkat_golongan:
        participant.pangkat_golongan || "",
      jabatan:
        participant.jabatan || "",
      instansi:
        participant.instansi || "",
      unit_kerja:
        participant.unit_kerja || "",
      email:
        participant.email || "",
      phone:
        participant.phone || "",
    });

    setShowEditModal(true);
  }

  // =====================================================
  // UPDATE PARTICIPANT
  // =====================================================

  async function handleUpdateParticipant() {
    if (!selectedParticipant) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (!editForm.full_name.trim()) {
        alert("Nama lengkap wajib diisi.");
        return;
      }

      const {
        error: updateError,
      } = await supabase
        .from("participants")
        .update({
          full_name:
            editForm.full_name.trim(),
          nip:
            editForm.nip.trim() || null,
          pangkat_golongan:
            editForm.pangkat_golongan.trim() ||
            null,
          jabatan:
            editForm.jabatan.trim() || null,
          instansi:
            editForm.instansi.trim() || null,
          unit_kerja:
            editForm.unit_kerja.trim() || null,
          email:
            editForm.email.trim() || null,
          phone:
            editForm.phone.trim() || null,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          selectedParticipant.id
        );

      if (updateError) {
        console.error(
          "UPDATE PARTICIPANT ERROR:",
          updateError
        );

        alert(
          `Gagal memperbarui peserta: ${updateError.message}`
        );

        return;
      }

      alert(
        `Data ${editForm.full_name} berhasil diperbarui.`
      );

      setShowEditModal(false);
      setSelectedParticipant(null);

      await loadParticipants();
    } catch (err) {
      console.error(
        "Update participant error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memperbarui peserta."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // AKTIF / NONAKTIF
  // =====================================================

  async function handleToggleActive(
    participant: Participant
  ) {
    const newStatus =
      !participant.is_active;

    const action = newStatus
      ? "mengaktifkan"
      : "menonaktifkan";

    const confirmation =
      window.confirm(
        `Apakah Anda yakin ingin ${action} peserta "${participant.full_name}"?`
      );

    if (!confirmation) {
      return;
    }

    try {
      setUpdatingId(participant.id);
      setError("");

      const {
        error: updateError,
      } = await supabase
        .from("participants")
        .update({
          is_active: newStatus,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          participant.id
        );

      if (updateError) {
        console.error(
          "TOGGLE PARTICIPANT ERROR:",
          updateError
        );

        alert(
          `Gagal ${action} peserta: ${updateError.message}`
        );

        return;
      }

      alert(
        newStatus
          ? `Peserta ${participant.full_name} berhasil diaktifkan.`
          : `Peserta ${participant.full_name} berhasil dinonaktifkan.`
      );

      await loadParticipants();
    } catch (err) {
      console.error(
        "Toggle participant error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : `Terjadi kesalahan saat ${action} peserta.`
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // =====================================================
  // FILTER
  // =====================================================

  const filteredParticipants =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      return participants.filter(
        (participant) => {
          const matchesSearch =
            !keyword ||
            participant.full_name
              .toLowerCase()
              .includes(keyword) ||
            (participant.nip || "")
              .toLowerCase()
              .includes(keyword) ||
            (participant.instansi || "")
              .toLowerCase()
              .includes(keyword) ||
            (participant.jabatan || "")
              .toLowerCase()
              .includes(keyword);

          const matchesStatus =
            statusFilter === "all" ||
            (statusFilter === "active" &&
              participant.is_active) ||
            (statusFilter === "inactive" &&
              !participant.is_active);

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      participants,
      search,
      statusFilter,
    ]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalParticipants =
    participants.length;

  const activeParticipants =
    participants.filter(
      (participant) =>
        participant.is_active
    ).length;

  const inactiveParticipants =
    participants.filter(
      (participant) =>
        !participant.is_active
    ).length;

  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    window.location.href = "/login";
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="min-h-screen bg-gray-100">

      {/* HEADER */}

      <header className="border-b bg-white">

        <div className="flex min-h-16 items-center justify-between px-6 py-3">

          <div>

            <h1 className="text-xl font-bold text-gray-900">
              LSP-PDN Kemendagri
            </h1>

            <p className="text-xs text-gray-500">
              Sistem Uji Kompetensi Aparatur Pemerintahan Dalam Negeri
            </p>

          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Keluar
          </button>

        </div>

      </header>

      <div className="flex">

        {/* SIDEBAR */}

        <aside className="min-h-[calc(100vh-64px)] w-64 border-r bg-white p-4">

          <div className="mb-6 rounded-xl bg-blue-50 p-4">

            <p className="text-xs text-gray-500">
              Manajemen
            </p>

            <p className="mt-1 font-semibold text-gray-900">
              Peserta
            </p>

            <p className="mt-1 text-xs text-blue-600">
              Kelola data peserta uji kompetensi
            </p>

          </div>

          <nav className="space-y-1">

            <Link
              href="/"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            <Link
              href="/users"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Pengguna
            </Link>

            <Link
              href="/participants"
              className="block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
            >
              Peserta
            </Link>

            <Link
              href="/assessors"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Asesor
            </Link>

            <Link
              href="/competency-tests"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Uji Kompetensi
            </Link>

            <Link
              href="/question-bank"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Bank Soal
            </Link>

            <Link
              href="/schedules"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Jadwal Ujian
            </Link>

          </nav>

        </aside>

        {/* CONTENT */}

        <section className="flex-1 p-6">

          {/* TITLE */}

          <div className="mb-6 flex items-center justify-between">

            <div>

              <h2 className="text-2xl font-bold text-gray-900">
                Data Peserta
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Kelola data peserta yang mengikuti Uji Kompetensi.
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                setShowModal(true)
              }
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Tambah Peserta
            </button>

          </div>

          {/* SUMMARY */}

          <div className="mb-6 grid gap-4 md:grid-cols-3">

            <SummaryCard
              title="Total Peserta"
              value={
                totalParticipants
              }
            />

            <SummaryCard
              title="Peserta Aktif"
              value={
                activeParticipants
              }
            />

            <SummaryCard
              title="Tidak Aktif"
              value={
                inactiveParticipants
              }
            />

          </div>

          {/* ERROR */}

          {error && (

            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">

              <p className="text-sm font-medium text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={
                  loadParticipants
                }
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Coba Lagi
              </button>

            </div>

          )}

          {/* TABLE */}

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

            {/* TOOLBAR */}

            <div className="flex flex-col gap-4 border-b px-6 py-4 lg:flex-row lg:items-center lg:justify-between">

              <div>

                <h3 className="font-semibold text-gray-900">
                  Daftar Peserta
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  {filteredParticipants.length} peserta ditampilkan.
                </p>

              </div>

              <div className="flex flex-col gap-2 sm:flex-row">

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Cari nama, NIP, instansi..."
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
                />

                <select
                  value={
                    statusFilter
                  }
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value
                    )
                  }
                  className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >

                  <option value="all">
                    Semua Status
                  </option>

                  <option value="active">
                    Aktif
                  </option>

                  <option value="inactive">
                    Tidak Aktif
                  </option>

                </select>

                <button
                  type="button"
                  onClick={
                    loadParticipants
                  }
                  disabled={
                    loading
                  }
                  className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  {loading
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>

              </div>

            </div>

            {/* CONTENT */}

            {loading ? (

              <div className="p-10 text-center">

                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

                <p className="mt-4 text-sm text-gray-500">
                  Memuat data peserta...
                </p>

              </div>

            ) : filteredParticipants.length === 0 ? (

              <div className="p-10 text-center">

                <p className="text-sm font-medium text-gray-700">
                  Tidak ada data peserta.
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Silakan tambahkan peserta baru atau ubah filter pencarian.
                </p>

              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="min-w-[1100px] text-sm">

                  <thead className="bg-gray-50">

                    <tr>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        No
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        NIP
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Nama Lengkap
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Pangkat/Golongan
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Jabatan
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Instansi
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Status
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Aksi
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y">

                    {filteredParticipants.map(
                      (
                        item,
                        index
                      ) => (

                        <tr
                          key={
                            item.id
                          }
                          className="hover:bg-gray-50"
                        >

                          <td className="px-6 py-4 text-gray-500">
                            {index + 1}
                          </td>

                          <td className="px-6 py-4 font-mono text-xs text-gray-700">
                            {item.nip || "-"}
                          </td>

                          <td className="px-6 py-4">

                            <div className="font-medium text-gray-900">
                              {item.full_name}
                            </div>

                            {item.email && (
                              <div className="mt-1 text-xs text-gray-500">
                                {item.email}
                              </div>
                            )}

                          </td>

                          <td className="px-6 py-4 text-gray-700">
                            {item.pangkat_golongan || "-"}
                          </td>

                          <td className="px-6 py-4 text-gray-700">
                            {item.jabatan || "-"}
                          </td>

                          <td className="px-6 py-4">

                            <div className="font-medium text-gray-700">
                              {item.instansi || "-"}
                            </div>

                            {item.unit_kerja && (
                              <div className="mt-1 text-xs text-gray-500">
                                {item.unit_kerja}
                              </div>
                            )}

                          </td>

                          <td className="px-6 py-4">

                            {item.is_active ? (

                              <span className="font-medium text-green-600">
                                ● Aktif
                              </span>

                            ) : (

                              <span className="font-medium text-red-600">
                                ● Tidak Aktif
                              </span>

                            )}

                          </td>

                          <td className="px-6 py-4">

                            <div className="flex gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  handleEdit(
                                    item
                                  )
                                }
                                className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleActive(
                                    item
                                  )
                                }
                                disabled={
                                  updatingId ===
                                  item.id
                                }
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                                  item.is_active
                                    ? "border-red-200 text-red-600 hover:bg-red-50"
                                    : "border-green-200 text-green-600 hover:bg-green-50"
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                              >
                                {updatingId ===
                                item.id
                                  ? "Memproses..."
                                  : item.is_active
                                  ? "Nonaktifkan"
                                  : "Aktifkan"}
                              </button>

                            </div>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </section>

      </div>

      {/* =====================================================
          MODAL TAMBAH PESERTA
      ===================================================== */}

      {showModal && (

        <ParticipantModal
          title="Tambah Peserta"
          description="Tambahkan data peserta baru ke dalam sistem."
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={
            closeAddModal
          }
          onSubmit={
            handleCreateParticipant
          }
          submitText="Simpan Peserta"
          pangkatGolonganList={
            pangkatGolonganList
          }
        />

      )}

      {/* =====================================================
          MODAL EDIT PESERTA
      ===================================================== */}

      {showEditModal &&
        selectedParticipant && (

          <ParticipantModal
            title="Edit Peserta"
            description="Perbarui data peserta."
            form={editForm}
            setForm={setEditForm}
            saving={saving}
            onClose={
              closeEditModal
            }
            onSubmit={
              handleUpdateParticipant
            }
            submitText="Simpan Perubahan"
            pangkatGolonganList={
              pangkatGolonganList
            }
          />

        )}

    </main>
  );
}

// =========================================================
// PARTICIPANT MODAL
// =========================================================

function ParticipantModal({
  title,
  description,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
  submitText,
  pangkatGolonganList,
}: {
  title: string;
  description: string;
  form: ParticipantForm;
  setForm: React.Dispatch<
    React.SetStateAction<ParticipantForm>
  >;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitText: string;
  pangkatGolonganList: PangkatGolongan[];
}) {
  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">

      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b px-6 py-4">

          <div>

            <h3 className="text-lg font-bold text-gray-900">
              {title}
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              {description}
            </p>

          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-2xl leading-none text-gray-400 hover:text-gray-700 disabled:opacity-50"
          >
            ×
          </button>

        </div>

        {/* FORM */}

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">

          <InputField
            label="Nama Lengkap"
            value={
              form.full_name
            }
            placeholder="Masukkan nama lengkap"
            onChange={(value) =>
              setForm({
                ...form,
                full_name:
                  value,
              })
            }
            required
          />

          <InputField
            label="NIP"
            value={
              form.nip
            }
            placeholder="Masukkan NIP"
            onChange={(value) =>
              setForm({
                ...form,
                nip: value,
              })
            }
          />

          {/* PANGKAT / GOLONGAN */}

          <div className="space-y-2">

            <label className="block text-sm font-medium text-gray-700">
              Pangkat/Golongan
            </label>

            <select
              value={
                form.pangkat_golongan
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  pangkat_golongan:
                    e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >

              <option value="">
                Pilih Pangkat/Golongan
              </option>

              {pangkatGolonganList.map(
                (item) => (

                  <option
                    key={item.id}
                    value={
                      item.pangkat_golongan
                    }
                  >
                    {
                      item.pangkat_golongan
                    }
                  </option>

                )
              )}

            </select>

          </div>

          {/* JABATAN */}

          <InputField
            label="Jabatan"
            value={
              form.jabatan
            }
            placeholder="Masukkan jabatan"
            onChange={(value) =>
              setForm({
                ...form,
                jabatan:
                  value,
              })
            }
          />

          {/* INSTANSI */}

          <InputField
            label="Instansi"
            value={
              form.instansi
            }
            placeholder="Masukkan instansi"
            onChange={(value) =>
              setForm({
                ...form,
                instansi:
                  value,
              })
            }
          />

          {/* UNIT KERJA */}

          <InputField
            label="Unit Kerja"
            value={
              form.unit_kerja
            }
            placeholder="Masukkan unit kerja"
            onChange={(value) =>
              setForm({
                ...form,
                unit_kerja:
                  value,
              })
            }
          />

          {/* EMAIL */}

          <InputField
  label="Email"
  type="email"
  value={form.email}
  placeholder="contoh@email.com"
  onChange={(value) =>
    setForm({
      ...form,
      email: value,
    })
  }
  required
/>

          {/* NOMOR TELEPON */}

          <InputField
            label="Nomor Telepon"
            value={
              form.phone
            }
            placeholder="Contoh: 08123456789"
            onChange={(value) =>
              setForm({
                ...form,
                phone:
                  value,
              })
            }
          />

        </div>

        {/* FOOTER */}

        <div className="flex justify-end gap-3 border-t px-6 py-4">

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Menyimpan..."
              : submitText}
          </button>

        </div>

      </div>

    </div>
  );
}

// =========================================================
// INPUT FIELD
// =========================================================

function InputField({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (

    <div>

      <label className="mb-1 block text-sm font-medium text-gray-700">

        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}

      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder={
          placeholder
        }
        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

    </div>
  );
}

// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (

    <div className="rounded-xl border bg-white p-4 shadow-sm">

      <p className="text-xs text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>

    </div>
  );
}
