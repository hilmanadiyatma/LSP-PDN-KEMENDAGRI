"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [nip, setNip] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const cleanNip = nip.trim();

      if (!cleanNip) {
        setError("NIP wajib diisi.");
        setLoading(false);
        return;
      }

      if (!password) {
        setError("Password wajib diisi.");
        setLoading(false);
        return;
      }

      /*
       * LOGIN MENGGUNAKAN NIP
       *
       * NIP dikirim ke Edge Function.
       * Edge Function yang akan:
       *
       * 1. mencari NIP pada profiles
       * 2. mencari email internal user
       * 3. melakukan autentikasi Supabase
       * 4. mengembalikan session
       */

      const { data, error: functionError } =
        await supabase.functions.invoke(
          "login-with-nip",
          {
            body: {
              nip: cleanNip,
              password,
            },
          }
        );

      if (functionError) {
        console.error(
          "LOGIN FUNCTION ERROR:",
          functionError
        );

        setError(
          "Server login tidak dapat dihubungi. Pastikan Edge Function login-with-nip sudah aktif."
        );

        setLoading(false);
        return;
      }

      if (!data) {
        setError(
          "Tidak ada respons dari server login."
        );

        setLoading(false);
        return;
      }

      if (!data.success) {
        setError(
          data.error ||
            "NIP atau password tidak sesuai."
        );

        setLoading(false);
        return;
      }

      const accessToken =
        data.session?.access_token;

      const refreshToken =
        data.session?.refresh_token;

      if (!accessToken || !refreshToken) {
        console.error(
          "Session tidak lengkap:",
          data
        );

        setError(
          "Login berhasil tetapi session tidak ditemukan."
        );

        setLoading(false);
        return;
      }

      /*
       * SIMPAN SESSION SUPABASE
       */

      const {
        error: sessionError,
      } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error(
          "SESSION ERROR:",
          sessionError
        );

        setError(
          "Gagal membuat session login."
        );

        setLoading(false);
        return;
      }

      /*
       * LOGIN BERHASIL
       */

      window.location.href = "/";
    } catch (err) {
      console.error(
        "LOGIN ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat login."
      );

      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">

        {/* HEADER */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            LSP-PDN Kemendagri
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Sistem Uji Kompetensi Aparatur
            Pemerintahan Dalam Negeri
          </p>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >

          {/* NIP */}
          <div>
            <label
              htmlFor="nip"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              NIP
            </label>

            <input
              id="nip"
              type="text"
              inputMode="numeric"
              value={nip}
              onChange={(event) =>
                setNip(event.target.value)
              }
              placeholder="Masukkan NIP"
              autoComplete="username"
              required
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Masukkan password"
              autoComplete="current-password"
              required
              disabled={loading}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* ERROR */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">
                Login gagal
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>
          )}

          {/* BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Memproses login..."
              : "Login"}
          </button>

        </form>

        {/* FOOTER */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            LSP-PDN Kemendagri
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Login menggunakan NIP
          </p>
        </div>

      </div>
    </main>
  );
}