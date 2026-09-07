"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string;
  role_id: number;
  is_active: boolean;
  role_name: string;
};

type MenuItem = {
  label: string;
  href: string;
};

const menuByRole: Record<string, MenuItem[]> = {
  super_admin: [
    { label: "Dashboard", href: "/" },
    { label: "Pengguna", href: "/users" },
    { label: "Peserta", href: "/participants" },
    { label: "Asesor", href: "/assessors" },
    { label: "Uji Kompetensi", href: "/competency-tests" },
    { label: "Bank Soal", href: "/question-bank" },
    { label: "Jadwal Ujian", href: "/schedules" },
    { label: "Laporan", href: "/reports" },
    { label: "Audit Trail", href: "/audit-trail" },
    { label: "Pengaturan", href: "/settings" },
  ],

  admin_operator: [
    { label: "Dashboard", href: "/" },
    { label: "Peserta", href: "/participants" },
    { label: "Jadwal Ujian", href: "/schedules" },
    { label: "Monitoring", href: "/monitoring" },
  ],

  admin_uk: [
    { label: "Dashboard", href: "/" },
    { label: "Uji Kompetensi", href: "/competency-tests" },
    { label: "Bank Soal", href: "/question-bank" },
    { label: "Jadwal Ujian", href: "/schedules" },
    { label: "Hasil Uji", href: "/results" },
  ],

  asesor: [
    { label: "Dashboard", href: "/" },
    { label: "Peserta Ditugaskan", href: "/assigned-participants" },
    { label: "Uji Kasus", href: "/case-assessment" },
    { label: "Uji Wawancara", href: "/interviews" },
    { label: "Penilaian", href: "/assessments" },
  ],

  peserta: [
    { label: "Dashboard", href: "/" },
    { label: "Profil", href: "/profile" },
    { label: "Form APL", href: "/apl" },
    { label: "Jadwal", href: "/schedules" },
    { label: "Uji CAT", href: "/cat-exam" },
    { label: "Uji Kasus", href: "/case-exam" },
    { label: "Uji Wawancara", href: "/interviews" },
    { label: "Hasil", href: "/results" },
  ],
};

function getRoleName(roleId: number): string {
  const roles: Record<number, string> = {
    1: "super_admin",
    2: "admin_operator",
    3: "admin_uk",
    4: "asesor",
    5: "peserta",
  };

  return roles[roleId] || "";
}

function getRoleLabel(roleName: string): string {
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    admin_operator: "Admin Operator",
    admin_uk: "Admin Uji Kompetensi",
    asesor: "Asesor Uji Kompetensi",
    peserta: "Peserta Uji Kompetensi",
  };

  return labels[roleName] || roleName;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [totalPeserta, setTotalPeserta] = useState(0);
  const [totalAsesor, setTotalAsesor] = useState(0);
  const [totalUji, setTotalUji] = useState(0);

  // Jumlah jadwal khusus peserta yang sedang login
  const [totalJadwal, setTotalJadwal] = useState(0);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("Auth error:", authError);
        window.location.href = "/login";
        return;
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      /*
       * AMBIL PROFILE USER LOGIN
       */
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, role_id, is_active")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        console.error("Profile error:", error);
        setProfile(null);
        return;
      }

      if (!data.is_active) {
        await supabase.auth.signOut();
        window.location.href = "/login";
        return;
      }

      const roleName = getRoleName(Number(data.role_id));

      setProfile({
        full_name: data.full_name || "Pengguna",
        role_id: Number(data.role_id),
        is_active: data.is_active,
        role_name: roleName,
      });

      /*
       * TOTAL PESERTA
       */
      const { count: pesertaCount, error: pesertaError } =
        await supabase
          .from("participants")
          .select("*", {
            count: "exact",
            head: true,
          });

      if (pesertaError) {
        console.error(
          "Gagal mengambil jumlah peserta:",
          pesertaError
        );
      } else {
        setTotalPeserta(pesertaCount ?? 0);
      }

      /*
       * TOTAL ASESOR
       */
      const { count: asesorCount, error: asesorError } =
        await supabase
          .from("assessors")
          .select("*", {
            count: "exact",
            head: true,
          });

      if (asesorError) {
        console.error(
          "Gagal mengambil jumlah asesor:",
          asesorError
        );
      } else {
        setTotalAsesor(asesorCount ?? 0);
      }

      /*
       * TOTAL UJI KOMPETENSI
       */
      const { count: ujiCount, error: ujiError } =
        await supabase
          .from("competency_tests")
          .select("*", {
            count: "exact",
            head: true,
          });

      if (ujiError) {
        console.error(
          "Gagal mengambil jumlah uji kompetensi:",
          ujiError
        );
      } else {
        setTotalUji(ujiCount ?? 0);
      }

      /*
       * TOTAL JADWAL PESERTA
       *
       * Alur:
       * user login
       *      ↓
       * profiles.id
       *      ↓
       * participants.user_id
       *      ↓
       * participants.id
       *      ↓
       * participant_schedules.participant_id
       */
      if (roleName === "peserta") {
        const {
          data: participant,
          error: participantError,
        } = await supabase
          .from("participants")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (participantError || !participant) {
          console.error(
            "Gagal mengambil data peserta:",
            participantError
          );

          setTotalJadwal(0);
        } else {
          const {
            count: jadwalCount,
            error: jadwalError,
          } = await supabase
            .from("participant_schedules")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("participant_id", participant.id);

          if (jadwalError) {
            console.error(
              "Gagal mengambil jumlah jadwal:",
              jadwalError
            );

            setTotalJadwal(0);
          } else {
            setTotalJadwal(jadwalCount ?? 0);
          }
        }
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white px-8 py-6 shadow-sm">
          <p className="text-sm text-gray-500">
            Memuat dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">
            Profil tidak ditemukan
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Akun berhasil login tetapi data profil tidak ditemukan.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Kembali ke Login
          </button>
        </div>
      </main>
    );
  }

  const roleLabel = getRoleLabel(profile.role_name);
  const menus = menuByRole[profile.role_name] || [];

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
              Pengguna
            </p>

            <p className="mt-1 font-semibold text-gray-900">
              {profile.full_name}
            </p>

            <p className="mt-1 text-xs font-medium text-blue-600">
              {roleLabel}
            </p>
          </div>

          <nav className="space-y-1">
            {menus.map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className={
                  menu.href === "/"
                    ? "block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
                    : "block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                }
              >
                {menu.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* CONTENT */}
        <section className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Dashboard {roleLabel}
            </h2>

            <p className="mt-1 text-gray-500">
              Selamat datang, {profile.full_name}.
            </p>
          </div>

          {/* DASHBOARD PESERTA */}
          {profile.role_name === "peserta" && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Status Peserta"
                  value="Aktif"
                  description="Status akun peserta"
                />

                <StatCard
                  title="Uji Kompetensi"
                  value={String(totalUji)}
                  description="Kegiatan tersedia"
                />

                <StatCard
                  title="Jadwal Ujian"
                  value={String(totalJadwal)}
                  description="Jadwal tersedia"
                />

                <StatCard
                  title="Hasil Ujian"
                  value="0"
                  description="Hasil tersedia"
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border bg-white p-6">
                  <h3 className="font-semibold text-gray-900">
                    Informasi Peserta
                  </h3>

                  <div className="mt-4 space-y-3">
                    <InfoItem
                      label="Nama"
                      value={profile.full_name}
                    />

                    <InfoItem
                      label="Status Akun"
                      value="Aktif"
                    />

                    <InfoItem
                      label="Peran"
                      value={roleLabel}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-6">
                  <h3 className="font-semibold text-gray-900">
                    Akses Uji Kompetensi
                  </h3>

                  <div className="mt-4 space-y-2">
                    <Link
                      href="/schedules"
                      className="block rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Lihat Jadwal Ujian
                    </Link>

                    <Link
                      href="/cat-exam"
                      className="block rounded-lg border px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Masuk Uji CAT
                    </Link>

                    <Link
                      href="/case-exam"
                      className="block rounded-lg border px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Masuk Uji Kasus
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* DASHBOARD ADMIN OPERATOR */}
          {profile.role_name === "admin_operator" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Peserta"
                value={String(totalPeserta)}
                description="Peserta terdaftar"
              />

              <StatCard
                title="Jadwal Mendatang"
                value="0"
                description="Kegiatan terjadwal"
              />

              <StatCard
                title="Sesi Ujian"
                value="0"
                description="Sesi tersedia"
              />

              <StatCard
                title="Ujian Berlangsung"
                value="0"
                description="Sedang berjalan"
              />
            </div>
          )}

          {/* DASHBOARD ADMIN / SUPER ADMIN / ASESOR */}
          {profile.role_name !== "peserta" &&
            profile.role_name !== "admin_operator" && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total Peserta"
                  value={String(totalPeserta)}
                  description="Peserta terdaftar"
                />

                <StatCard
                  title="Total Asesor"
                  value={String(totalAsesor)}
                  description="Asesor aktif"
                />

                <StatCard
                  title="Uji Kompetensi"
                  value={String(totalUji)}
                  description="Kegiatan tersedia"
                />

                <StatCard
                  title="Ujian Berlangsung"
                  value="0"
                  description="Sedang berjalan"
                />
              </div>
            )}

          {/* STATUS SISTEM */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold text-gray-900">
                Status Sistem
              </h3>

              <div className="mt-4 space-y-3">
                <StatusItem
                  label="Supabase"
                  status="Terhubung"
                />

                <StatusItem
                  label="Authentication"
                  status="Aktif"
                />

                <StatusItem
                  label="Database"
                  status="Aktif"
                />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold text-gray-900">
                Aktivitas Terbaru
              </h3>

              <p className="mt-4 text-sm text-gray-500">
                Belum ada aktivitas.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {description}
      </p>
    </div>
  );
}

function StatusItem({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3">
      <span className="text-sm text-gray-600">
        {label}
      </span>

      <span className="text-sm font-medium text-green-600">
        ● {status}
      </span>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3">
      <span className="text-sm text-gray-500">
        {label}
      </span>

      <span className="text-sm font-semibold text-gray-900">
        {value}
      </span>
    </div>
  );
}