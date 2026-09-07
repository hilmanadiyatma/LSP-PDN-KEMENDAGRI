"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Schedule = {
  id: number;
  name: string;
  description: string | null;
  start_at: string;
  end_at: string;
  location: string | null;
  meeting_url: string | null;
  test_name: string;
  test_type: string;
  status: string;
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const {
      data: participant,
      error: participantError,
    } = await supabase
      .from("participants")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (participantError || !participant) {
      console.error(participantError);
      setError("Data peserta tidak ditemukan.");
      setLoading(false);
      return;
    }

    const {
      data,
      error: scheduleError,
    } = await supabase
      .from("participant_schedules")
      .select(`
        id,
        schedule_id,
        status,
        test_schedules (
          id,
          name,
          description,
          start_at,
          end_at,
          location,
          meeting_url,
          competency_tests (
            name,
            test_type
          )
        )
      `)
      .eq("participant_id", participant.id)
      .order("created_at", { ascending: false });

    if (scheduleError) {
      console.error(scheduleError);
      setError("Jadwal ujian gagal dimuat.");
      setLoading(false);
      return;
    }

    const formatted: Schedule[] = (data || [])
      .map((item: any) => {
        const schedule = Array.isArray(item.test_schedules)
          ? item.test_schedules[0]
          : item.test_schedules;

        if (!schedule) {
          return null;
        }

        const competencyTest = Array.isArray(
          schedule.competency_tests
        )
          ? schedule.competency_tests[0]
          : schedule.competency_tests;

        return {
          id: Number(schedule.id),
          name: schedule.name,
          description: schedule.description,
          start_at: schedule.start_at,
          end_at: schedule.end_at,
          location: schedule.location,
          meeting_url: schedule.meeting_url,
          test_name: competencyTest?.name || "-",
          test_type: competencyTest?.test_type || "-",
          status: item.status || "terdaftar",
        };
      })
      .filter(Boolean) as Schedule[];

    setSchedules(formatted);
    setLoading(false);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function getTestTypeLabel(type: string) {
    const labels: Record<string, string> = {
      cat: "Uji CAT",
      case: "Uji Kasus",
      interview: "Uji Wawancara",
    };

    return labels[type] || type;
  }

  function getExamLink(type: string, scheduleId: number) {
    const query = `?schedule_id=${scheduleId}`;

    if (type === "cat") {
      return `/cat-exam${query}`;
    }

    if (type === "case") {
      return `/case-exam${query}`;
    }

    if (type === "interview") {
      return `/interviews${query}`;
    }

    return "#";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-500">
          Memuat jadwal ujian...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              LSP-PDN Kemendagri
            </h1>

            <p className="text-xs text-gray-500">
              Sistem Uji Kompetensi Aparatur Pemerintahan Dalam Negeri
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="p-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Jadwal Ujian
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Jadwal Uji Kompetensi yang diberikan kepada Anda.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && schedules.length === 0 && (
            <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
              <div className="text-4xl">📅</div>

              <h2 className="mt-4 text-lg font-semibold text-gray-900">
                Belum Ada Jadwal
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Saat ini belum ada jadwal ujian yang diberikan kepada
                akun Anda.
              </p>
            </div>
          )}

          <div className="space-y-5">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {getTestTypeLabel(schedule.test_type)}
                      </span>

                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        {schedule.status}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900">
                      {schedule.name}
                    </h2>

                    <p className="mt-1 text-sm font-medium text-gray-600">
                      {schedule.test_name}
                    </p>

                    {schedule.description && (
                      <p className="mt-3 text-sm text-gray-500">
                        {schedule.description}
                      </p>
                    )}

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Tanggal
                        </p>

                        <p className="mt-1 text-sm font-medium text-gray-800">
                          {formatDate(schedule.start_at)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Waktu
                        </p>

                        <p className="mt-1 text-sm font-medium text-gray-800">
                          {formatTime(schedule.start_at)} -{" "}
                          {formatTime(schedule.end_at)} WIB
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400">
                          Lokasi
                        </p>

                        <p className="mt-1 text-sm font-medium text-gray-800">
                          {schedule.location || "Online"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="lg:w-44">
                    <Link
                      href={getExamLink(
                        schedule.test_type,
                        schedule.id
                      )}
                      className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Lihat Ujian
                    </Link>

                    {schedule.meeting_url && (
                      <a
                        href={schedule.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block w-full rounded-lg border px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Link Pertemuan
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}