import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey
) {
  throw new Error(
    "Konfigurasi Supabase belum lengkap."
  );
}

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const supabaseAuth = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type CreateParticipantRequest = {
  full_name: string;
  nip: string;
  pangkat_golongan: string;
  jabatan: string;
  instansi: string;
  unit_kerja: string;
  email: string;
  phone: string;
};

function generatePassword() {
  const randomPart = crypto
    .randomBytes(6)
    .toString("hex");

  return `Lsp@${randomPart}`;
}

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null;

  try {
    // =====================================================
    // CEK TOKEN LOGIN ADMIN
    // =====================================================

    const authorization =
      request.headers.get("authorization");

    if (!authorization) {
      return NextResponse.json(
        {
          success: false,
          message: "Sesi login tidak ditemukan.",
        },
        { status: 401 }
      );
    }

    const token = authorization.replace(
      "Bearer ",
      ""
    );

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Token login tidak valid.",
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Sesi login sudah tidak valid.",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // AMBIL DATA
    // =====================================================

    const body =
      (await request.json()) as CreateParticipantRequest;

    const fullName =
      body.full_name?.trim() || "";

    const nip =
      body.nip?.trim() || "";

    const email =
      body.email?.trim().toLowerCase() || "";

    const pangkatGolongan =
      body.pangkat_golongan?.trim() || "";

    const jabatan =
      body.jabatan?.trim() || "";

    const instansi =
      body.instansi?.trim() || "";

    const unitKerja =
      body.unit_kerja?.trim() || "";

    const phone =
      body.phone?.trim() || "";

    // =====================================================
    // VALIDASI
    // =====================================================

    if (!fullName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nama lengkap wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!nip) {
      return NextResponse.json(
        {
          success: false,
          message:
            "NIP wajib diisi untuk membuat akun peserta.",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email wajib diisi untuk membuat akun login peserta.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CEK PESERTA BERDASARKAN NIP
    // =====================================================

    const {
      data: existingParticipant,
      error: existingParticipantError,
    } = await supabaseAdmin
      .from("participants")
      .select(
        "id, full_name, nip, email, user_id"
      )
      .eq("nip", nip)
      .maybeSingle();

    if (existingParticipantError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal memeriksa data peserta.",
          detail:
            existingParticipantError.message,
        },
        { status: 500 }
      );
    }

    if (existingParticipant) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Peserta dengan NIP ${nip} sudah terdaftar.`,
        },
        { status: 409 }
      );
    }

    // =====================================================
    // CEK EMAIL DI PARTICIPANTS
    // =====================================================

    const {
      data: existingEmail,
      error: existingEmailError,
    } = await supabaseAdmin
      .from("participants")
      .select("id, full_name, email, user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingEmailError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Gagal memeriksa email peserta.",
          detail:
            existingEmailError.message,
        },
        { status: 500 }
      );
    }

    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Email ${email} sudah digunakan oleh peserta lain.`,
        },
        { status: 409 }
      );
    }

    // =====================================================
    // BUAT PASSWORD SEMENTARA
    // =====================================================

    const temporaryPassword =
      generatePassword();

    // =====================================================
    // BUAT USER DI SUPABASE AUTHENTICATION
    // =====================================================

    const {
      data: authData,
      error: createAuthError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            nip,
            role: "peserta",
          },
        }
      );

    if (createAuthError) {
      console.error(
        "CREATE AUTH USER ERROR:",
        createAuthError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            `Gagal membuat akun login: ${createAuthError.message}`,
        },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Akun Authentication gagal dibuat.",
        },
        { status: 500 }
      );
    }

    createdAuthUserId =
      authData.user.id;

    // =====================================================
    // SIMPAN PESERTA
    // =====================================================

    const {
      data: participantData,
      error: participantInsertError,
    } =
      await supabaseAdmin
        .from("participants")
        .insert({
          user_id: authData.user.id,
          full_name: fullName,
          nip: nip,
          pangkat_golongan:
            pangkatGolongan || null,
          jabatan:
            jabatan || null,
          instansi:
            instansi || null,
          unit_kerja:
            unitKerja || null,
          email,
          phone:
            phone || null,
          is_active: true,
        })
        .select()
        .single();

    // =====================================================
    // JIKA INSERT PARTICIPANT GAGAL
    // HAPUS USER AUTH YANG BARU DIBUAT
    // =====================================================

    if (participantInsertError) {
      console.error(
        "CREATE PARTICIPANT ERROR:",
        participantInsertError
      );

      await supabaseAdmin.auth.admin.deleteUser(
        authData.user.id
      );

      createdAuthUserId = null;

      return NextResponse.json(
        {
          success: false,
          message:
            `Peserta gagal disimpan: ${participantInsertError.message}`,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // BERHASIL
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        message:
          "Peserta dan akun login berhasil dibuat.",
        participant: participantData,
        credentials: {
          full_name: fullName,
          nip,
          email,
          password: temporaryPassword,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "CREATE PARTICIPANT ACCOUNT ERROR:",
      error
    );

    // =====================================================
    // CLEANUP JIKA TERJADI ERROR
    // =====================================================

    if (createdAuthUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(
          createdAuthUserId
        );
      } catch (cleanupError) {
        console.error(
          "AUTH CLEANUP ERROR:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}