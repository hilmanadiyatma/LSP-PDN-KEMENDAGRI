"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Participant = {
  id: number;
  full_name: string;
  nip: string | null;
  jabatan: string | null;
  instansi: string | null;
};

type Scheme = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
};

type Profile = {
  id: number;
  competency_scheme_id: number;
  code: string;
  name: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
};

type Registration = {
  id: number;
  participant_id: number;
  competency_scheme_id: number;
  competency_profile_id: number;
  registration_number: string | null;
  registration_date: string;
  status: string;
};

export default function CertificationAssignmentsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  const [participantId, setParticipantId] = useState("");
  const [schemeId, setSchemeId] = useState("");
  const [profileId, setProfileId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedSchemeProfiles = useMemo(() => {
    if (!schemeId) {
      return [];
    }

    return profiles
      .filter(
        (profile) =>
          profile.competency_scheme_id === Number(schemeId) &&
          profile.is_active
      )
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [profiles, schemeId]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const participantsResult = await supabase
        .from("participants")
        .select(
          "id, full_name, nip, jabatan, instansi"
        )
        .eq("is_active", true)
        .order("full_name");

      if (participantsResult.error) {
        throw new Error(
          `Gagal mengambil peserta: ${participantsResult.error.message}`
        );
      }

      const schemesResult = await supabase.rpc(
        "admin_get_competency_schemes"
      );

      if (schemesResult.error) {
        throw new Error(
          `Gagal mengambil skema: ${schemesResult.error.message}`
        );
      }

      const profilesResult = await supabase.rpc(
        "admin_get_competency_profiles"
      );

      if (profilesResult.error) {
        throw new Error(
          `Gagal mengambil profil: ${profilesResult.error.message}`
        );
      }

      const registrationsResult = await supabase.rpc(
  "admin_get_certification_registrations"
);

if (registrationsResult.error) {
  throw new Error(
    `Gagal mengambil registrasi: ${registrationsResult.error.message}`
  );
}

      setParticipants(
        (participantsResult.data || []) as Participant[]
      );

      setSchemes(
        (schemesResult.data || []) as Scheme[]
      );

      setProfiles(
        (profilesResult.data || []) as Profile[]
      );

      setRegistrations(
        (registrationsResult.data || []) as Registration[]
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleSchemeChange(value: string) {
    setSchemeId(value);
    setProfileId("");
  }

  async function createRegistration() {
  setError("");
  setSuccess("");

  if (!participantId) {
    setError("Silakan pilih peserta.");
    return;
  }

  if (!schemeId) {
    setError("Silakan pilih skema kompetensi.");
    return;
  }

  if (!profileId) {
    setError("Silakan pilih profil / target kompetensi.");
    return;
  }

  const selectedProfile = profiles.find(
    (profile) => profile.id === Number(profileId)
  );

  if (!selectedProfile) {
    setError("Profil kompetensi tidak ditemukan.");
    return;
  }

  if (
    selectedProfile.competency_scheme_id !==
    Number(schemeId)
  ) {
    setError(
      "Profil kompetensi tidak sesuai dengan skema yang dipilih."
    );
    return;
  }

  const selectedParticipant = participants.find(
    (participant) =>
      participant.id === Number(participantId)
  );

  const selectedScheme = schemes.find(
    (scheme) => scheme.id === Number(schemeId)
  );

  setSaving(true);

  try {
    const { data: registrationId, error: registrationError } =
      await supabase.rpc(
        "admin_create_certification_registration",
        {
          p_participant_id: Number(participantId),
          p_competency_scheme_id: Number(schemeId),
          p_competency_profile_id: Number(profileId),
        }
      );

    if (registrationError) {
      if (
        registrationError.message.includes(
          "CERTIFICATION_REGISTRATION_ALREADY_EXISTS"
        )
      ) {
        throw new Error(
          `${
            selectedParticipant?.full_name || "Peserta"
          } sudah terdaftar pada skema dan profil tersebut.`
        );
      }

      throw new Error(
        `Gagal membuat registrasi: ${registrationError.message}`
      );
    }

    if (!registrationId) {
      throw new Error(
        "Registrasi gagal dibuat karena ID registrasi tidak dikembalikan."
      );
    }

    setSuccess(
      `Registrasi berhasil dibuat untuk ${
        selectedParticipant?.full_name || "peserta"
      } pada skema ${
        selectedScheme?.name || "-"
      } dengan profil ${
        selectedProfile.name
      }.`
    );

    setParticipantId("");
    setSchemeId("");
    setProfileId("");

    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat membuat registrasi."
    );
  } finally {
    setSaving(false);
  }
}
  function getParticipant(id: number) {
    return participants.find(
      (participant) => participant.id === id
    );
  }

  function getScheme(id: number) {
    return schemes.find(
      (scheme) => scheme.id === id
    );
  }

  function getProfile(id: number) {
    return profiles.find(
      (profile) => profile.id === id
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            Memuat Assignment Sertifikasi...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Assignment Sertifikasi
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Menetapkan peserta ke skema dan profil
            kompetensi yang akan diikuti.
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* FORM */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Buat Assignment Baru
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Admin menentukan peserta, skema, dan
              profil kompetensi. Peserta tidak memilih
              sendiri.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">

            {/* PESERTA */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Peserta
              </label>

              <select
                value={participantId}
                onChange={(e) =>
                  setParticipantId(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="">
                  Pilih Peserta
                </option>

                {participants.map((participant) => (
                  <option
                    key={participant.id}
                    value={participant.id}
                  >
                    {participant.full_name}
                    {participant.nip
                      ? ` — ${participant.nip}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* SKEMA */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Skema Kompetensi
              </label>

              <select
                value={schemeId}
                onChange={(e) =>
                  handleSchemeChange(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                <option value="">
                  Pilih Skema
                </option>

                {schemes.map((scheme) => (
                  <option
                    key={scheme.id}
                    value={scheme.id}
                  >
                    {scheme.name}
                  </option>
                ))}
              </select>
            </div>

            {/* PROFIL */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Profil / Target Kompetensi
              </label>

              <select
                value={profileId}
                onChange={(e) =>
                  setProfileId(e.target.value)
                }
                disabled={!schemeId}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none disabled:bg-slate-100 focus:border-slate-500"
              >
                <option value="">
                  {schemeId
                    ? "Pilih Profil"
                    : "Pilih skema terlebih dahulu"}
                </option>

                {selectedSchemeProfiles.map(
                  (profile) => (
                    <option
                      key={profile.id}
                      value={profile.id}
                    >
                      {profile.name}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* PREVIEW */}
          {participantId &&
            schemeId &&
            profileId && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Preview Assignment
                </p>

                <div className="mt-3 grid gap-4 md:grid-cols-3">

                  <div>
                    <p className="text-xs text-slate-500">
                      Peserta
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {
                        getParticipant(
                          Number(participantId)
                        )?.full_name
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Skema
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {
                        getScheme(
                          Number(schemeId)
                        )?.name
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Profil
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {
                        getProfile(
                          Number(profileId)
                        )?.name
                      }
                    </p>
                  </div>

                </div>
              </div>
            )}

          {/* BUTTON */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={createRegistration}
              disabled={saving}
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Menyimpan..."
                : "Daftarkan Sertifikasi"}
            </button>
          </div>
        </section>

        {/* REGISTRATION LIST */}
        <section className="rounded-2xl border bg-white shadow-sm">

          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Daftar Sertifikasi Peserta
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Riwayat assignment sertifikasi yang
              sudah dibuat.
            </p>
          </div>

          {registrations.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Belum ada registrasi sertifikasi.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1000px] text-sm">

                <thead className="bg-slate-50 text-left">
                  <tr>

                    <th className="px-6 py-4 font-semibold text-slate-600">
                      Peserta
                    </th>

                    <th className="px-6 py-4 font-semibold text-slate-600">
                      Skema
                    </th>

                    <th className="px-6 py-4 font-semibold text-slate-600">
                      Profil
                    </th>

                    <th className="px-6 py-4 font-semibold text-slate-600">
                      Nomor Registrasi
                    </th>

                    <th className="px-6 py-4 font-semibold text-slate-600">
                      Tanggal
                    </th>

                    <th className="px-6 py-4 font-semibold text-slate-600">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {registrations.map(
                    (registration) => {
                      const participant =
                        getParticipant(
                          registration.participant_id
                        );

                      const scheme =
                        getScheme(
                          registration.competency_scheme_id
                        );

                      const profile =
                        getProfile(
                          registration.competency_profile_id
                        );

                      return (
                        <tr
                          key={registration.id}
                          className="hover:bg-slate-50"
                        >

                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">
                              {participant?.full_name ||
                                "-"}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {participant?.nip || "-"}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-800">
                              {scheme?.name || "-"}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {scheme?.code || "-"}
                            </div>
                          </td>

                          <td className="px-6 py-4 font-medium text-slate-800">
                            {profile?.name || "-"}
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {registration.registration_number ||
                              "-"}
                          </td>

                          <td className="px-6 py-4 text-slate-600">
                            {registration.registration_date}
                          </td>

                          <td className="px-6 py-4">
                            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              {registration.status}
                            </span>
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}