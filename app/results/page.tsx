"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CompetencyTest = {
  name: string;
  test_type: string;
};

type Result = {
  id: number;
  participant_id: number;
  competency_test_id: number;
  attempt_id: number | null;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  score: number;
  passing_score: number;
  status: string;
  created_at: string;
  updated_at: string;
  competency_tests?: CompetencyTest | CompetencyTest[] | null;
};

type Attempt = {
  id: number;
  violation_count: number;
  disqualification_reason: string | null;
  status: string;
};

export default function ResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [attempts, setAttempts] = useState<Record<number, Attempt>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    console.log("====================================");
    console.log("MULAI LOAD HASIL");
    console.log("====================================");

    try {
      setLoading(true);
      setError("");

      // ==========================================
      // 1. CEK USER LOGIN
      // ==========================================

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      console.log("USER:", user);
      console.log("AUTH ERROR:", authError);

      if (authError || !user) {
        console.log("USER BELUM LOGIN");
        window.location.href = "/login";
        return;
      }

      // ==========================================
      // 2. CARI DATA PESERTA
      // ==========================================

      const {
        data: participant,
        error: participantError,
      } = await supabase
        .from("participants")
        .select("id, full_name, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log("====================================");
      console.log("PARTICIPANT");
      console.log("====================================");
      console.log("PARTICIPANT:", participant);
      console.log("PARTICIPANT ERROR:", participantError);

      if (participantError) {
        setError(
          "Gagal mengambil data peserta: " +
            participantError.message
        );
        return;
      }

      if (!participant) {
        setError("Data peserta tidak ditemukan.");
        return;
      }

      console.log("PARTICIPANT ID:", participant.id);

      // ==========================================
      // 3. AMBIL HASIL
      // ==========================================

      console.log("====================================");
      console.log("QUERY RESULTS");
      console.log("====================================");

      const {
        data: resultData,
        error: resultError,
      } = await supabase
        .from("results")
        .select("*")
        .eq("participant_id", participant.id)
        .order("created_at", {
          ascending: false,
        });

      console.log("RESULT DATA:", resultData);
      console.log("RESULT ERROR:", resultError);

      if (resultError) {
        setError(
          "Gagal mengambil hasil ujian: " +
            resultError.message
        );
        return;
      }

      const safeResults = (resultData || []) as Result[];

      console.log("JUMLAH HASIL:", safeResults.length);

      setResults(safeResults);

      // ==========================================
      // 4. AMBIL DATA ATTEMPT
      // ==========================================

      const attemptIds = safeResults
        .map((result) => result.attempt_id)
        .filter(
          (id): id is number =>
            id !== null
        );

      console.log("ATTEMPT IDS:", attemptIds);

      if (attemptIds.length === 0) {
        setAttempts({});
        return;
      }

      const {
        data: attemptData,
        error: attemptError,
      } = await supabase
        .from("exam_attempts")
        .select(
          "id, violation_count, disqualification_reason, status"
        )
        .in("id", attemptIds);

      console.log("ATTEMPT DATA:", attemptData);
      console.log("ATTEMPT ERROR:", attemptError);

      if (attemptError) {
        console.error(
          "Gagal mengambil attempt:",
          attemptError
        );
        return;
      }

      const attemptMap: Record<number, Attempt> = {};

      (attemptData || []).forEach((attempt) => {
        attemptMap[Number(attempt.id)] = {
          id: Number(attempt.id),
          violation_count: Number(
            attempt.violation_count || 0
          ),
          disqualification_reason:
            attempt.disqualification_reason,
          status: attempt.status,
        };
      });

      setAttempts(attemptMap);

      console.log("====================================");
      console.log("LOAD HASIL SELESAI");
      console.log("====================================");
    } catch (err) {
      console.error("ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // FORMAT TEST TYPE
  // ==========================================

  function getTestTypeLabel(type?: string) {
    switch (type) {
      case "cat":
        return "Uji CAT";

      case "case":
        return "Uji Kasus";

      case "interview":
        return "Uji Wawancara";

      default:
        return "Uji Kompetensi";
    }
  }

  // ==========================================
  // FORMAT STATUS
  // ==========================================

  function getStatusLabel(status?: string) {
    switch (status) {
      case "lulus":
        return "LULUS";

      case "tidak_lulus":
        return "TIDAK LULUS";

      case "submitted":
        return "SELESAI";

      case "expired":
        return "WAKTU HABIS";

      case "disqualified":
      case "diskualifikasi":
        return "DIDISKUALIFIKASI";

      default:
        return (
          status
            ?.replaceAll("_", " ")
            .toUpperCase() || "SELESAI"
        );
    }
  }

  // ==========================================
  // FORMAT TANGGAL
  // ==========================================

  function formatDate(date?: string) {
    if (!date) return "-";

    return new Date(date).toLocaleString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ==========================================
  // CEK DISKUALIFIKASI
  // ==========================================

  function isDisqualified(result: Result) {
    if (!result.attempt_id) {
      return false;
    }

    const attempt =
      attempts[result.attempt_id];

    if (!attempt) {
      return false;
    }

    return (
      Boolean(attempt.disqualification_reason) ||
      attempt.status === "disqualified" ||
      attempt.status === "diskualifikasi"
    );
  }

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-2xl bg-white p-8 shadow">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

            <p className="text-sm font-medium text-gray-700">
              Memuat hasil ujian...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // HALAMAN
  // ==========================================

  return (
    <main className="min-h-screen bg-gray-100">

      {/* HEADER */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <h1 className="text-xl font-bold text-gray-900">
              LSP-PDN Kemendagri
            </h1>

            <p className="mt-1 text-xs text-gray-500">
              Sistem Uji Kompetensi Aparatur
              Pemerintahan Dalam Negeri
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>

        </div>
      </header>

      {/* CONTENT */}

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* TITLE */}

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Hasil Ujian
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Riwayat hasil Uji Kompetensi Anda.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">

            <p className="font-semibold text-red-800">
              Terjadi Kesalahan
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>

            <button
              onClick={() => loadResults()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Muat Ulang
            </button>

          </div>
        )}

        {/* TIDAK ADA HASIL */}

        {!error && results.length === 0 && (
          <div className="rounded-2xl border bg-white p-12 text-center shadow-sm">

            <div className="text-6xl">
              📊
            </div>

            <h3 className="mt-5 text-xl font-bold text-gray-900">
              Belum Ada Hasil Ujian
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Anda belum menyelesaikan ujian.
            </p>

            <Link
              href="/schedules"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Lihat Jadwal Ujian
            </Link>

          </div>
        )}

        {/* HASIL UJIAN */}

        <div className="space-y-6">

          {results.map((result) => {

            const attempt =
              result.attempt_id
                ? attempts[result.attempt_id]
                : null;

            const disqualified =
              isDisqualified(result);

            const passed =
              result.status === "lulus" &&
              !disqualified;

            const finalStatus =
              disqualified
                ? "DIDISKUALIFIKASI"
                : getStatusLabel(
                    result.status
                  );

            return (
              <div
                key={result.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              >

                {/* HEADER HASIL */}

                <div className="border-b bg-gray-50 p-6">

                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">

                    <div>

                      <div className="flex flex-wrap gap-2">

                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          Uji CAT
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            passed
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {finalStatus}
                        </span>

                        {disqualified && (
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                            ⚠ Diskualifikasi
                          </span>
                        )}

                      </div>

                      <h3 className="mt-4 text-xl font-bold text-gray-900">
                        Sertifikasi Kompetensi ASN Tahun 2026
                      </h3>

                      <p className="mt-2 text-sm text-gray-500">
                        Uji Kompetensi Aparatur Sipil Negara LSP-PDN Kemendagri
                      </p>

                      <p className="mt-2 text-xs text-gray-400">
                        {formatDate(
                          result.created_at
                        )}
                      </p>

                    </div>

                    {/* NILAI */}

                    <div className="rounded-xl bg-white px-8 py-5 text-center shadow-sm">

                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Nilai
                      </p>

                      <p
                        className={`mt-1 text-5xl font-bold ${
                          passed
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {Number(
                          result.score || 0
                        ).toFixed(2)}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        Passing Grade{" "}
                        {Number(
                          result.passing_score || 0
                        ).toFixed(2)}
                      </p>

                    </div>

                  </div>

                </div>

                {/* STATISTIK */}

                <div className="p-6">

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                    <div className="rounded-xl border bg-gray-50 p-5">
                      <p className="text-xs text-gray-500">
                        Jumlah Soal
                      </p>

                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        {result.total_questions || 0}
                      </p>
                    </div>

                    <div className="rounded-xl border bg-gray-50 p-5">
                      <p className="text-xs text-gray-500">
                        Dijawab
                      </p>

                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        {result.answered_questions || 0}
                      </p>
                    </div>

                    <div className="rounded-xl border bg-gray-50 p-5">
                      <p className="text-xs text-gray-500">
                        Jawaban Benar
                      </p>

                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        {result.correct_answers || 0}
                      </p>
                    </div>

                    <div className="rounded-xl border bg-gray-50 p-5">
                      <p className="text-xs text-gray-500">
                        Status
                      </p>

                      <p
                        className={`mt-2 text-lg font-bold ${
                          passed
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {finalStatus}
                      </p>
                    </div>

                  </div>

                  {/* PELANGGARAN */}

                  {attempt &&
                    attempt.violation_count > 0 && (
                      <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">

                        <div className="flex items-start gap-3">

                          <div className="text-2xl">
                            ⚠️
                          </div>

                          <div>

                            <h4 className="font-bold text-red-800">
                              Informasi Pelanggaran
                            </h4>

                            <p className="mt-1 text-sm text-red-700">
                              Jumlah pelanggaran:{" "}
                              <strong>
                                {attempt.violation_count}/2
                              </strong>
                            </p>

                            {attempt.disqualification_reason && (
                              <div className="mt-3 rounded-lg bg-white p-4">

                                <p className="text-xs font-semibold uppercase text-gray-400">
                                  Alasan
                                </p>

                                <p className="mt-2 text-sm text-gray-700">
                                  {
                                    attempt.disqualification_reason
                                  }
                                </p>

                              </div>
                            )}

                          </div>

                        </div>

                      </div>
                    )}

                  {/* STATUS AKHIR */}

                  <div
                    className={`mt-6 rounded-xl border p-5 ${
                      passed
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >

                    <div className="flex items-start gap-3">

                      <div className="text-2xl">
                        {passed
                          ? "✅"
                          : disqualified
                          ? "⛔"
                          : "❌"}
                      </div>

                      <div>

                        <h4
                          className={`font-bold ${
                            passed
                              ? "text-green-800"
                              : "text-red-800"
                          }`}
                        >
                          {passed
                            ? "Selamat, Anda Lulus!"
                            : disqualified
                            ? "Ujian Didiskualifikasi"
                            : "Anda Belum Lulus"}
                        </h4>

                        <p
                          className={`mt-1 text-sm ${
                            passed
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {passed
                            ? "Nilai Anda memenuhi passing grade yang telah ditentukan."
                            : disqualified
                            ? "Ujian Anda dinyatakan tidak lulus karena terjadi pelanggaran yang menyebabkan diskualifikasi."
                            : "Nilai Anda belum memenuhi passing grade yang telah ditentukan."}
                        </p>

                      </div>

                    </div>

                  </div>

                </div>

              </div>
            );
          })}

        </div>

      </div>
    </main>
  );
}