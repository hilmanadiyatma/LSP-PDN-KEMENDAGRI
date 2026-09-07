import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // =========================
    // CEK USER YANG MEMANGGIL
    // =========================

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Tidak terautentikasi.",
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

    const token = authHeader.replace("Bearer ", "");

    const {
      data: {
        user: currentUser,
      },
      error: currentUserError,
    } = await supabaseAdmin.auth.getUser(token);

    if (currentUserError || !currentUser) {
      return new Response(
        JSON.stringify({
          error: "Session login tidak valid.",
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

    // =========================
    // CEK ROLE PEMBUAT
    // =========================

    const {
      data: creatorProfile,
      error: creatorError,
    } = await supabaseAdmin
      .from("profiles")
      .select("role_id, is_active")
      .eq("id", currentUser.id)
      .single();

    if (
      creatorError ||
      !creatorProfile ||
      !creatorProfile.is_active
    ) {
      return new Response(
        JSON.stringify({
          error: "Profil pengguna tidak ditemukan atau tidak aktif.",
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

    // Hanya Super Admin
    if (Number(creatorProfile.role_id) !== 1) {
      return new Response(
        JSON.stringify({
          error:
            "Hanya Super Admin yang dapat membuat pengguna.",
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

    // =========================
    // BACA DATA
    // =========================

    const body = await req.json();

    const nip = String(body.nip || "").trim();
    const fullName = String(body.full_name || "").trim();
    const password = String(body.password || "");
    const roleId = Number(body.role_id);

    if (!nip || !fullName || !password || !roleId) {
      return new Response(
        JSON.stringify({
          error:
            "NIP, nama lengkap, role, dan password wajib diisi.",
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

    // =========================
    // VALIDASI ROLE
    // =========================

    if (![2, 3, 4, 5].includes(roleId)) {
      return new Response(
        JSON.stringify({
          error: "Role pengguna tidak valid.",
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

    // =========================
    // CEK NIP DUPLIKAT
    // =========================

    const {
      data: existingProfile,
    } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("nip", nip)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          error: "NIP sudah terdaftar.",
        }),
        {
          status: 409,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // =========================
    // EMAIL INTERNAL
    // =========================

    /*
     * Login tetap menggunakan NIP.
     *
     * Email ini hanya digunakan oleh
     * Supabase Authentication sebagai
     * identitas internal.
     */

    const internalEmail = `${nip}@login.lsp-pdn.local`;

    // =========================
    // BUAT AUTH USER
    // =========================

    const {
      data: createdUser,
      error: createAuthError,
    } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
    });

    if (createAuthError || !createdUser.user) {
      console.error(
        "CREATE AUTH ERROR:",
        createAuthError
      );

      return new Response(
        JSON.stringify({
          error:
            createAuthError?.message ||
            "Gagal membuat akun login.",
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

    const newUserId = createdUser.user.id;

    // =========================
    // BUAT PROFILE
    // =========================

    const {
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUserId,
        full_name: fullName,
        nip,
        role_id: roleId,
        is_active: true,
      });

    // Jika profile gagal, hapus Auth user
    if (profileError) {
      console.error(
        "PROFILE ERROR:",
        profileError
      );

      await supabaseAdmin.auth.admin.deleteUser(
        newUserId
      );

      return new Response(
        JSON.stringify({
          error:
            "Gagal membuat profil pengguna.",
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

    // =========================
    // BERHASIL
    // =========================

    return new Response(
      JSON.stringify({
        success: true,
        message: "Pengguna berhasil dibuat.",
        user: {
          id: newUserId,
          nip,
          full_name: fullName,
          role_id: roleId,
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
      "CREATE USER ERROR:",
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