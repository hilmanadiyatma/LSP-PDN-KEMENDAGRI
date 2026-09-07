import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error: "Konfigurasi Supabase belum tersedia.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();

    const nip = String(body.nip || "").trim();
    const password = String(body.password || "");

    if (!nip || !password) {
      return new Response(
        JSON.stringify({
          error: "NIP dan password wajib diisi.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // Cari peserta berdasarkan NIP
    const {
      data: participant,
      error: participantError,
    } = await supabaseAdmin
      .from("participants")
      .select(
        `
        id,
        full_name,
        nip,
        email,
        user_id,
        is_active
      `
      )
      .eq("nip", nip)
      .single();

    if (participantError || !participant) {
      return new Response(
        JSON.stringify({
          error: "NIP atau password tidak sesuai.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Cek status peserta
    if (!participant.is_active) {
      return new Response(
        JSON.stringify({
          error: "Akun peserta tidak aktif.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Cek apakah sudah mempunyai akun
    if (!participant.user_id) {
      return new Response(
        JSON.stringify({
          error:
            "Peserta belum memiliki akun. Silakan hubungi administrator.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          }
        }
      );
    }

    // Ambil user Auth berdasarkan user_id
    const {
      data: authUser,
      error: authUserError,
    } = await supabaseAdmin.auth.admin.getUserById(
      participant.user_id
    );

    if (
      authUserError ||
      !authUser.user ||
      !authUser.user.email
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Akun peserta tidak ditemukan di sistem login.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const loginEmail = authUser.user.email;

    // Verifikasi password
    const {
      data: sessionData,
      error: loginError,
    } = await supabaseAdmin.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (
      loginError ||
      !sessionData.session ||
      !sessionData.user
    ) {
      return new Response(
        JSON.stringify({
          error: "NIP atau password tidak sesuai.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Login berhasil
    return new Response(
      JSON.stringify({
        success: true,

        user: {
          id: sessionData.user.id,
          email: sessionData.user.email,
          full_name: participant.full_name,
          nip: participant.nip,
        },

        session: {
          access_token:
            sessionData.session.access_token,
          refresh_token:
            sessionData.session.refresh_token,
          expires_at:
            sessionData.session.expires_at,
          expires_in:
            sessionData.session.expires_in,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "LOGIN WITH NIP ERROR:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada server.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});