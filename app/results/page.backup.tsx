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
  competency_tests:
    | CompetencyTest
    | CompetencyTest[]
    | null;
};

type Attempt = {
  id: number;
  violation_count: number;
  disqualification_reason: string | null;
  status: string;
};

export default function ResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [attempts, setAttempts] = useState<
    Record<number, Attempt>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadResults();
  }, []);

  async function loadResults() {
    try {
      setLoading(true);
      setError("");

      /*
       * =====================================================
       * 1. CEK USER LOGIN
       * =====================================================
       */

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        window.location.href = "/login";
        return;
      }

      /*
       * =====================================================
       * 2. AMBIL DATA PESERTA
       * =====================================================
       */

      const {
        data: participant,
        error: participantError,
      } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (
        participantError ||
        !participant
      ) {
        console.error(
          "Participant error:",
          participantError
        );

        setError(
          "Data peserta tidak ditemukan."
        );

        return;
      }

      /*
       * =====================================================
       * 3. AMBIL HASIL UJIAN
       * =====================================================
       */

      const {
        data: resultData,
        error: resultError,
      } = await supabase
        .from("results")
        .select(`
          id,
          participant_id,
          competency_test_id,
          attempt_id,
          total_questions,
          answered_questions,
          correct_answers,
          score,
          passing_score,
          status,
          created_at,
          updated_at,
          competency_tests (
            name,
            test_type
          )
        `)
        .eq(
          "participant_id",
          participant.id
        )
        .order("created_at", {
          ascending: false,
        });

      if (resultError) {
        console.error(
          "Result error:",
          resultError
        );

        setError(
          `Hasil ujian gagal dimuat: ${resultError.message}`
        );

        return;
      }

      const safeResults =
        (resultData || []) as Result[];

      setResults(safeResults);

      /*
       * =====================================================
       * 4. AMBIL DATA ATTEMPT
       *
       * Digunakan untuk mengetahui:
       * - jumlah pelanggaran
       * - alasan diskualifikasi
       * - status attempt
       * =====================================================
       */

      const attemptIds =
        safeResults
          .map(
            (result) =>
              result.attempt_id
          )
          .filter(
            (
              id
            ): id is number =>
              id !== null
          );

      if (attemptIds.length > 0) {
        const {
          data: attemptData,
          error: attemptError,
        } = await supabase
          .from("exam_attempts")
          .select(`
            id,
            violation_count,
            disqualification_reason,
            status
          `)
          .in(
            "id",
            attemptIds
          );

        if (attemptError) {
          console.error(
            "Attempt error:",
            attemptError
          );
        } else {
          const attemptMap: Record<
            number,
            Attempt
          > = {};

          (
            attemptData || []
          ).forEach((attempt) => {
            attemptMap[
              Number(attempt.id)
            ] = {
              id: Number(
                attempt.id
              ),

              violation_count:
                Number(
                  attempt.violation_count ||
                    0
                ),

              disqualification_reason:
                attempt.disqualification_reason,

              status:
                attempt.status,
            };
          });

          setAttempts(
            attemptMap
          );
        }
      } else {
        setAttempts({});
      }
    } catch (err) {
      console.error(
        "Load results error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat hasil."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =====================================================
   * LABEL JENIS UJIAN
   * =====================================================
   */

  function getTestTypeLabel(
    type: string
  ) {
    const labels: Record<
      string,
      string
    > = {
      cat: "Uji CAT",
      case: "Uji Kasus",
      interview:
        "Uji Wawancara",
    };

    return (
      labels[type] ||
      type ||
      "Uji Kompetensi"
    );
  }

  /*
   * =====================================================
   * LABEL STATUS
   * =====================================================
   */

  function getStatusLabel(
    status: string
  ) {
    switch (status) {
      case "lulus":
        return "LULUS";

      case "tidak_lulus":
        return "TIDAK LULUS";

      case "submitted":
        return "SELESAI";

      case "expired":
        return "WAKTU HABIS";

      default:
        return status
          .replaceAll("_", " ")
          .toUpperCase();
    }
  }

  /*
   * =====================================================
   * FORMAT TANGGAL
   * =====================================================
   */

  function formatDate(
    date: string
  ) {
    return new Date(
      date
    ).toLocaleString(
      "id-ID",
      {
        weekday:
          "long",

        day: "2-digit",

        month:
          "long",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    );
  }

  /*
   * =====================================================
   * CEK APAKAH DISKUALIFIKASI
   * =====================================================
   */

  function isDisqualified(
    result: Result
  ) {
    const attempt =
      result.attempt_id
        ? attempts[
            result.attempt_id
          ]
        : null;

    return Boolean(
      attempt
        ?.disqualification_reason
    );
  }

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white px-8 py-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Memuat hasil ujian...
          </p>
        </div>
      </main>
    );
  }

  /*
   * =====================================================
   * HALAMAN UTAMA
   * =====================================================
   */

  return (
    <main className="min-h-screen bg-gray-100">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              LSP-PDN Kemendagri
            </h1>

            <p className="text-xs text-gray-500">
              Sistem Uji Kompetensi
              Aparatur Pemerintahan
              Dalam Negeri
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div className="mx-auto max-w-7xl p-6">
        {/* =====================================================
            TITLE
        ===================================================== */}

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Hasil Ujian
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Riwayat hasil Uji Kompetensi
            Anda.
          </p>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadResults()
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Muat Ulang
              </button>
            </div>
          </div>
        )}

        {/* =====================================================
            BELUM ADA HASIL
        ===================================================== */}

        {!error &&
          results.length === 0 && (
            <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
              <div className="text-5xl">
                📊
              </div>

              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Belum Ada Hasil Ujian
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Anda belum menyelesaikan
                ujian.
              </p>

              <Link
                href="/schedules"
                className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Lihat Jadwal Ujian
              </Link>
            </div>
          )}

        {/* =====================================================
            LIST HASIL
        ===================================================== */}

        <div className="space-y-6">
          {results.map(
            (result) => {
              const test =
                Array.isArray(
                  result.competency_tests
                )
                  ? result
                      .competency_tests[0]
                  : result.competency_tests;

              const passed =
                result.status ===
                "lulus";

              const disqualified =
                isDisqualified(
                  result
                );

              const attempt =
                result.attempt_id
                  ? attempts[
                      result.attempt_id
                    ]
                  : null;

              const violationCount =
                attempt
                  ?.violation_count ||
                0;

              return (
                <div
                  key={
                    result.id
                  }
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                >
                  {/* =================================================
                      CARD HEADER
                  ================================================= */}

                  <div className="border-b bg-gray-50 px-6 py-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* JENIS UJIAN */}

                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            {getTestTypeLabel(
                              test?.test_type ||
                                "cat"
                            )}
                          </span>

                          {/* STATUS */}

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              passed
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {getStatusLabel(
                              result.status
                            )}
                          </span>

                          {/* DISKUALIFIKASI */}

                          {disqualified && (
                            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                              DISKUALIFIKASI
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-xl font-bold text-gray-900">
                          {test?.name ||
                            "Uji Kompetensi ASN"}
                        </h3>

                        <p className="mt-2 text-sm text-gray-500">
                          {formatDate(
                            result.created_at
                          )}
                        </p>
                      </div>

                      {/* NILAI */}

                      <div className="rounded-xl bg-white px-6 py-4 text-left shadow-sm lg:min-w-48 lg:text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Nilai
                        </p>

                        <p
                          className={`mt-1 text-4xl font-bold ${
                            passed
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {Number(
                            result.score
                          ).toFixed(
                            2
                          )}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Passing Grade:{" "}
                          {Number(
                            result.passing_score
                          ).toFixed(
                            2
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      STATISTIK
                  ================================================= */}

                  <div className="p-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {/* JUMLAH SOAL */}

                      <div className="rounded-xl border bg-gray-50 p-4">
                        <p className="text-xs font-medium text-gray-500">
                          Jumlah Soal
                        </p>

                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {
                            result.total_questions
                          }
                        </p>
                      </div>

                      {/* DIJAWAB */}

                      <div className="rounded-xl border bg-gray-50 p-4">
                        <p className="text-xs font-medium text-gray-500">
                          Dijawab
                        </p>

                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {
                            result.answered_questions
                          }
                        </p>
                      </div>

                      {/* BENAR */}

                      <div className="rounded-xl border bg-gray-50 p-4">
                        <p className="text-xs font-medium text-gray-500">
                          Jawaban Benar
                        </p>

                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {
                            result.correct_answers
                          }
                        </p>
                      </div>

                      {/* STATUS */}

                      <div className="rounded-xl border bg-gray-50 p-4">
                        <p className="text-xs font-medium text-gray-500">
                          Status
                        </p>

                        <p
                          className={`mt-1 text-lg font-bold ${
                            passed
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {getStatusLabel(
                            result.status
                          )}
                        </p>
                      </div>
                    </div>

                    {/* =================================================
                        INFORMASI PELANGGARAN
                    ================================================= */}

                    {attempt &&
                      violationCount >
                        0 && (
                        <div
                          className={`mt-5 rounded-xl border p-5 ${
                            disqualified
                              ? "border-red-200 bg-red-50"
                              : "border-yellow-200 bg-yellow-50"
                          }`}
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <h4
                                className={`font-semibold ${
                                  disqualified
                                    ? "text-red-800"
                                    : "text-yellow-800"
                                }`}
                              >
                                Informasi Pelanggaran
                              </h4>

                              <p
                                className={`mt-1 text-sm ${
                                  disqualified
                                    ? "text-red-700"
                                    : "text-yellow-700"
                                }`}
                              >
                                Jumlah pelanggaran:{" "}
                                <span className="font-bold">
                                  {
                                    violationCount
                                  }
                                  /2
                                </span>
                              </p>
                            </div>

                            {disqualified && (
                              <span className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">
                                DIDISKUALIFIKASI
                              </span>
                            )}
                          </div>

                          {attempt.disqualification_reason && (
                            <div className="mt-4 rounded-lg bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Alasan Diskualifikasi
                              </p>

                              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                                {
                                  attempt.disqualification_reason
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                    {/* =================================================
                        KETERANGAN STATUS
                    ================================================= */}

                    <div
                      className={`mt-5 rounded-xl border p-5 ${
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
                            className={`font-semibold ${
                              passed
                                ? "text-green-800"
                                : "text-red-800"
                            }`}
                          >
                            {passed
                              ? "Selamat, Anda Lulus"
                              : disqualified
                              ? "Anda Didiskualifikasi"
                              : "Anda Belum Lulus"}
                          </h4>

                          <p
                            className={`mt-1 text-sm leading-relaxed ${
                              passed
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            {passed
                              ? `Nilai Anda ${Number(
                                  result.score
                                ).toFixed(
                                  2
                                )} telah memenuhi passing grade ${Number(
                                  result.passing_score
                                ).toFixed(
                                  2
                                )}.`
                              : disqualified
                              ? "Hasil ujian dinyatakan tidak lulus karena peserta didiskualifikasi akibat pelanggaran selama ujian."
                              : `Nilai Anda ${Number(
                                  result.score
                                ).toFixed(
                                  2
                                )} belum mencapai passing grade ${Number(
                                  result.passing_score
                                ).toFixed(
                                  2
                                )}.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    </main>
  );
}