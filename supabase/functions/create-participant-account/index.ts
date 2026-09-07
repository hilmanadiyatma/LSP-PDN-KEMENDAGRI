import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // =====================================================
  // CORS
  // =====================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method tidak diizinkan.",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    // =====================================================
    // SUPABASE CONFIG
    // =====================================================

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

    // =====================================================
    // CEK USER YANG MEMANGGIL FUNCTION
    // =====================================================

    const authorization = req.headers.get("Authorization");

    if (!authorization) {
      return new Response(
        JSON.stringify({
          error: "Anda belum login.",
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

    // Client menggunakan token user
    const supabaseUser = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: {
        user: currentUser,
      },
      error: currentUserError,
    } = await supabaseUser.auth.getUser();

    if (currentUserError || !currentUser) {
      console.error(
        "CURRENT USER ERROR:",
        currentUserError
      );

      return new Response(
        JSON.stringify({
          error: "Sesi login tidak valid.",
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

    // =====================================================
    // ADMIN CLIENT
    // =====================================================

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // =====================================================
    // CEK ROLE PEMBUAT USER
    // HANYA SUPER ADMIN
    // =====================================================

    const {
      data: currentProfile,
      error: currentProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        role_id,
        is_active
      `)
      .eq("id", currentUser.id)
      .maybeSingle();

    if (
      currentProfileError ||
      !currentProfile
    ) {
      return new Response(
        JSON.stringify({
          error: "Profile pengguna tidak ditemukan.",
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

    if (
      currentProfile.role_id !== 1 ||
      !currentProfile.is_active
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Anda tidak memiliki hak untuk membuat pengguna.",
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

    // =====================================================
    // AMBIL DATA REQUEST
    // =====================================================

    const body = await req.json();

    const nip = String(
      body.nip || ""
    ).trim();

    const fullName = String(
      body.full_name || ""
    ).trim();

    const email = String(
      body.email || ""
    )
      .trim()
      .toLowerCase();

    const roleId = Number(
      body.role_id
    );

    const password = String(
      body.password || ""
    );

    // =====================================================
    // VALIDASI
    // =====================================================

    if (!fullName) {
      return new Response(
        JSON.stringify({
          error: "Nama lengkap wajib diisi.",
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

    if (!email) {
      return new Response(
        JSON.stringify({
          error: "Email wajib diisi.",
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

    if (!email.includes("@")) {
      return new Response(
        JSON.stringify({
          error: "Format email tidak valid.",
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

    if (!Number.isInteger(roleId)) {
      return new Response(
        JSON.stringify({
          error: "Role pengguna wajib dipilih.",
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

    // Role yang diperbolehkan
    const allowedRoles = [1, 2, 3, 4, 5];

    if (!allowedRoles.includes(roleId)) {
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

    if (password.length < 6) {
      return new Response(
        JSON.stringify({
          error:
            "Password minimal 6 karakter.",
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

    // =====================================================
    // CEK NIP JIKA DIISI
    // =====================================================

    if (nip) {
      const {
        data: existingNip,
        error: nipError,
      } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("nip", nip)
        .maybeSingle();

      if (nipError) {
        console.error(
          "NIP CHECK ERROR:",
          nipError
        );

        return new Response(
          JSON.stringify({
            error:
              "Gagal memeriksa NIP pengguna.",
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

      if (existingNip) {
        return new Response(
          JSON.stringify({
            error:
              "NIP tersebut sudah terdaftar.",
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
    }

    // =====================================================
    // CEK EMAIL DI PROFILES
    // =====================================================

    const {
      data: existingEmail,
      error: emailCheckError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (emailCheckError) {
      console.error(
        "EMAIL CHECK ERROR:",
        emailCheckError
      );

      return new Response(
        JSON.stringify({
          error:
            "Gagal memeriksa email pengguna.",
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

    if (existingEmail) {
      return new Response(
        JSON.stringify({
          error:
            "Email tersebut sudah terdaftar.",
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

    // =====================================================
    // CEK ROLE DI TABLE ROLES
    // =====================================================

    const {
      data: role,
      error: roleError,
    } = await supabaseAdmin
      .from("roles")
      .select("id, name")
      .eq("id", roleId)
      .maybeSingle();

    if (roleError || !role) {
      return new Response(
        JSON.stringify({
          error: "Role pengguna tidak ditemukan.",
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

    // =====================================================
    // BUAT USER SUPABASE AUTH
    // =====================================================

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          nip: nip || null,
          role_id: roleId,
        },
      });

    if (authError || !authData.user) {
      console.error(
        "CREATE AUTH USER ERROR:",
        authError
      );

      return new Response(
        JSON.stringify({
          error:
            authError?.message ||
            "Gagal membuat akun pengguna.",
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

    const newUserId = authData.user.id;

    // =====================================================
    // BUAT PROFILE
    // =====================================================

    const {
      data: newProfile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUserId,
        user_id: newUserId,
        full_name: fullName,
        email,
        nip: nip || null,
        role_id: roleId,
        is_active: true,
      })
      .select(`
        id,
        user_id,
        full_name,
        email,
        nip,
        role_id,
        is_active,
        created_at
      `)
      .single();

    // =====================================================
    // JIKA PROFILE GAGAL → HAPUS AUTH USER
    // =====================================================

    if (profileError || !newProfile) {
      console.error(
        "CREATE PROFILE ERROR:",
        profileError
      );

      await supabaseAdmin.auth.admin.deleteUser(
        newUserId
      );

      return new Response(
        JSON.stringify({
          error:
            "Gagal membuat profile pengguna. Akun Auth dibatalkan.",
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

    // =====================================================
    // BERHASIL
    // =====================================================

    console.log(
      "USER CREATED:",
      newUserId,
      email,
      role.name
    );

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Pengguna berhasil dibuat.",
        user: {
          id: newProfile.id,
          full_name:
            newProfile.full_name,
          email: newProfile.email,
          nip: newProfile.nip,
          role_id:
            newProfile.role_id,
          role_name:
            role.name,
          is_active:
            newProfile.is_active,
          created_at:
            newProfile.created_at,
        },
      }),
      {
        status: 201,
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