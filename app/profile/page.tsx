"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfileData = {
  full_name: string | null;
  role_name: string | null;
  is_active: boolean;
  participant: {
    id: number;
    full_name: string;
    nip: string | null;
    pangkat_golongan: string | null;
    jabatan: string | null;
    instansi: string | null;
    unit_kerja: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        full_name,
        is_active,
        roles (
          name
        )
        `
      )
      .eq("id", user.id)
      .single();

    if (error || !data) {
      console.error(error);
      alert("Data profil tidak ditemukan.");
      setLoading(false);
      return;
    }

    const roleData = Array.isArray(data.roles)
      ? data.roles[0]
      : data.roles;

    const { data: participant, error: participantError } =
      await supabase
        .from("participants")
        .select(
          `
          id,
          full_name,
          nip,
          pangkat_golongan,
          jabatan,
          instansi,
          unit_kerja,
          email,
          phone
          `
        )
        .eq("user_id", user.id)
        .maybeSingle();

    if (participantError) {
      console.error(participantError);
    }

    setProfile({
      full_name: data.full_name,
      role_name: roleData?.name || null,
      is_active: data.is_active,
      participant: participant || null,
    });

    setLoading(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-500">
          Memuat profil...
        </p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white p-8 shadow">
          <p className="text-gray-600">
            Data profil tidak tersedia.
          </p>
        </div>
      </main>
    );
  }

  const participant = profile.participant;

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Profil Peserta
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Informasi akun dan data peserta Uji Kompetensi
            LSP-PDN Kemendagri
          </p>
        </div>

        {/* INFORMASI AKUN */}
        <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">
            Informasi Akun
          </h2>

          <div className="grid gap-5 md:grid-cols-2">

            <ProfileItem
              label="Nama"
              value={profile.full_name || "-"}
            />

            <ProfileItem
              label="Role"
              value={
                profile.role_name === "peserta"
                  ? "Peserta Uji Kompetensi"
                  : profile.role_name || "-"
              }
            />

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Status Akun
              </p>

              <div className="mt-2">
                <span
                  className={
                    profile.is_active
                      ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                      : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                  }
                >
                  {profile.is_active
                    ? "Aktif"
                    : "Tidak Aktif"}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* DATA PESERTA */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Data Peserta
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Data yang terdaftar pada sistem Uji Kompetensi.
            </p>
          </div>

          {!participant ? (
            <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-700">
              Data peserta belum terhubung dengan akun ini.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">

              <ProfileItem
                label="Nama Lengkap"
                value={participant.full_name}
              />

              <ProfileItem
                label="NIP"
                value={participant.nip || "-"}
              />

              <ProfileItem
                label="Pangkat / Golongan"
                value={
                  participant.pangkat_golongan || "-"
                }
              />

              <ProfileItem
                label="Jabatan"
                value={participant.jabatan || "-"}
              />

              <ProfileItem
                label="Instansi"
                value={participant.instansi || "-"}
              />

              <ProfileItem
                label="Unit Kerja"
                value={participant.unit_kerja || "-"}
              />

              <ProfileItem
                label="Email"
                value={participant.email || "-"}
              />

              <ProfileItem
                label="No. HP"
                value={participant.phone || "-"}
              />

            </div>
          )}
        </div>

      </div>
    </main>
  );
}

function ProfileItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-gray-500">
        {label}
      </p>

      <div className="mt-1 rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-800">
        {value}
      </div>
    </div>
  );
}