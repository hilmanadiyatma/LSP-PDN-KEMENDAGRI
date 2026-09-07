import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      email,
      password,
      full_name,
      role_id,
      is_active,
    } = body;

    // Validasi input
    if (!email || !password || !full_name || !role_id) {
      return NextResponse.json(
        {
          error: "Nama, email, password, dan role wajib diisi.",
        },
        { status: 400 }
      );
    }

    // Validasi role
    const { data: role, error: roleError } = await supabaseAdmin
      .from("roles")
      .select("id, name")
      .eq("id", role_id)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        {
          error: "Role pengguna tidak valid.",
        },
        { status: 400 }
      );
    }

    // Buat user di Supabase Authentication
    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json(
        {
          error: authError.message,
        },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          error: "User gagal dibuat.",
        },
        { status: 500 }
      );
    }

    // Buat profile
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .insert({
          id: authData.user.id,
          full_name,
          role_id: Number(role_id),
          is_active: is_active ?? true,
        })
        .select()
        .single();

    // Jika profile gagal dibuat, hapus user Auth
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(
        authData.user.id
      );

      return NextResponse.json(
        {
          error:
            "User berhasil dibuat tetapi profile gagal dibuat: " +
            profileError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Pengguna berhasil dibuat.",
        user: {
          id: authData.user.id,
          email: authData.user.email,
          profile,
          role: role.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}