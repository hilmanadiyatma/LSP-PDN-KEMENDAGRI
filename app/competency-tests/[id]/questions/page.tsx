"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CompetencyTest = {
  id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  test_type: string;
  is_active: boolean;
};

type Question = {
  id: number;
  competency_test_id: number;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string | null;
  difficulty: string | null;
  competency_unit: string | null;
  score: number | null;
  question_order: number;
  is_active: boolean;
};

export default function QuestionsPage() {
  const params = useParams();
  const router = useRouter();

  const id = Number(params.id);

  const [test, setTest] = useState<CompetencyTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      if (!id || Number.isNaN(id)) {
        throw new Error("ID uji kompetensi tidak valid.");
      }

      // ==========================================================
      // AMBIL DATA UJI KOMPETENSI
      // ==========================================================

      const {
        data: testData,
        error: testError,
      } = await supabase
        .from("competency_tests")
        .select(
          "id, name, description, duration_minutes, passing_score, test_type, is_active"
        )
        .eq("id", id)
        .single();

      if (testError) {
        throw new Error(
          `Gagal mengambil data uji kompetensi: ${testError.message}`
        );
      }

      if (!testData) {
        throw new Error("Uji kompetensi tidak ditemukan.");
      }

      setTest(testData as CompetencyTest);

      // ==========================================================
      // AMBIL BANK SOAL MELALUI RPC ADMIN
      // ==========================================================

      const {
        data: questionData,
        error: questionError,
      } = await supabase.rpc("admin_get_question_bank", {
        p_competency_test_id: id,
      });

      if (questionError) {
        throw new Error(
          `Gagal mengambil Bank Soal: ${questionError.message}`
        );
      }

      setQuestions((questionData || []) as Question[]);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  const activeQuestions = questions.filter(
    (question) => question.is_active
  );

  // ==========================================================
  // TOGGLE STATUS SOAL
  // ==========================================================

  async function toggleQuestion(question: Question) {
    try {
      const { error } = await supabase
        .from("question_bank")
        .update({
          is_active: !question.is_active,
        })
        .eq("id", question.id);

      if (error) {
        throw error;
      }

      await loadData();
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Gagal mengubah status soal."
      );
    }
  }

  // ==========================================================
  // HAPUS SOAL
  // ==========================================================

  async function deleteQuestion(question: Question) {
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin menghapus soal ini?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const { error } = await supabase
        .from("question_bank")
        .delete()
        .eq("id", question.id);

      if (error) {
        throw error;
      }

      await loadData();
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Gagal menghapus soal."
      );
    }
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-white p-8 text-center">
          Memuat Bank Soal...
        </div>
      </div>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="mb-4 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          {"<-"} Kembali
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-700">
            Gagal Memuat Bank Soal
          </h2>

          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>

          <button
            onClick={loadData}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================
  // HALAMAN UTAMA
  // ==========================================================

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {"<-"} Kembali
          </button>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bank Soal
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                {test?.name}
              </p>
            </div>

            <button
              onClick={() =>
                alert(
                  "Form Tambah Soal akan kita buat pada langkah berikutnya."
                )
              }
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Tambah Soal
            </button>
          </div>
        </div>

        {/* ======================================================
            STATISTICS
        ====================================================== */}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Total Soal
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {questions.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Soal Aktif
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {activeQuestions.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Durasi
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {test?.duration_minutes || 0}
              <span className="ml-1 text-sm font-normal">
                menit
              </span>
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">
              Passing Grade
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {test?.passing_score || 0}
            </p>
          </div>
        </div>

        {/* ======================================================
            EMPTY STATE
        ====================================================== */}

        {questions.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center">
            <div className="text-5xl">
              📝
            </div>

            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              Belum Ada Soal
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              Belum ada soal untuk uji kompetensi ini.
            </p>

            <button
              onClick={() =>
                alert(
                  "Form Tambah Soal akan kita buat pada langkah berikutnya."
                )
              }
              className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Tambah Soal
            </button>
          </div>
        ) : (

          /* ====================================================
             QUESTION LIST
          ==================================================== */

          <div className="space-y-5">

            {questions.map((question, index) => (
              <div
                key={question.id}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >

                {/* QUESTION HEADER */}

                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">

                  <div className="flex gap-3">

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>

                    <div>

                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Soal #{question.question_order}
                      </p>

                      <p className="mt-1 text-base font-medium leading-7 text-gray-900">
                        {question.question_text}
                      </p>

                    </div>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      question.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {question.is_active
                      ? "Aktif"
                      : "Nonaktif"}
                  </span>

                </div>

                {/* OPTIONS */}

                <div className="mt-5 grid gap-3 md:grid-cols-2">

                  <div className="rounded-lg border bg-gray-50 p-3">
                    <span className="font-semibold">
                      A.
                    </span>{" "}
                    {question.option_a || "-"}
                  </div>

                  <div className="rounded-lg border bg-gray-50 p-3">
                    <span className="font-semibold">
                      B.
                    </span>{" "}
                    {question.option_b || "-"}
                  </div>

                  <div className="rounded-lg border bg-gray-50 p-3">
                    <span className="font-semibold">
                      C.
                    </span>{" "}
                    {question.option_c || "-"}
                  </div>

                  <div className="rounded-lg border bg-gray-50 p-3">
                    <span className="font-semibold">
                      D.
                    </span>{" "}
                    {question.option_d || "-"}
                  </div>

                </div>

                {/* META */}

                <div className="mt-5 flex flex-wrap gap-3 border-t pt-4 text-sm">

                  <span className="rounded-lg bg-gray-100 px-3 py-1.5">
                    Kesulitan:{" "}
                    <strong>
                      {question.difficulty || "-"}
                    </strong>
                  </span>

                  <span className="rounded-lg bg-gray-100 px-3 py-1.5">
                    Unit:{" "}
                    <strong>
                      {question.competency_unit || "-"}
                    </strong>
                  </span>

                  <span className="rounded-lg bg-gray-100 px-3 py-1.5">
                    Nilai:{" "}
                    <strong>
                      {question.score ?? 0}
                    </strong>
                  </span>

                  <span className="rounded-lg bg-blue-100 px-3 py-1.5 text-blue-700">
                    Jawaban:{" "}
                    <strong>
                      {question.correct_answer || "-"}
                    </strong>
                  </span>

                </div>

                {/* ACTIONS */}

                <div className="mt-5 flex flex-wrap gap-2">

                  <button
                    onClick={() =>
                      alert(
                        "Form Edit Soal akan kita buat pada langkah berikutnya."
                      )
                    }
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      toggleQuestion(question)
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      question.is_active
                        ? "border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                        : "border border-green-300 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {question.is_active
                      ? "Nonaktifkan"
                      : "Aktifkan"}
                  </button>

                  <button
                    onClick={() =>
                      deleteQuestion(question)
                    }
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Hapus
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}

      </div>
    </div>
  );
}