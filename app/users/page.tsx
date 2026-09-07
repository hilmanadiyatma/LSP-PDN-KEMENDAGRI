"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Role = {
  id: number;
  name: string;
  description: string | null;
};

type UserProfile = {
  id: string;
  nip: string | null;
  full_name: string;
  role_id: number;
  is_active: boolean;
  created_at: string;
  roles: Role | null;
};

const roleDisplayNames: Record<string, string> = {
  super_admin: "Super Admin",
  admin_operator: "Admin Operator",
  admin_uk: "Admin UJK",
  asesor: "Asesor Uji Kompetensi",
  peserta: "Peserta Uji Kompetensi",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] =
    useState<UserProfile | null>(null);

  const [form, setForm] = useState({
    nip: "",
    full_name: "",
    email: "",
    role_id: "",
    password: "",
  });

  const [editForm, setEditForm] = useState({
    nip: "",
    full_name: "",
    role_id: "",
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  // =====================================================
  // LOAD INITIAL DATA
  // =====================================================

  async function loadInitialData() {
    await Promise.all([
      loadUsers(),
      loadRoles(),
    ]);
  }

  // =====================================================
  // LOAD USERS
  // =====================================================

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("AUTH ERROR:", authError);
        setError("Sesi login tidak valid.");
        return;
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error: profileError } =
        await supabase
          .from("profiles")
          .select(`
            id,
            nip,
            full_name,
            role_id,
            is_active,
            created_at,
            roles (
              id,
              name,
              description
            )
          `)
          .order("created_at", {
            ascending: false,
          });

      if (profileError) {
        console.error(
          "GAGAL MENGAMBIL USERS:",
          profileError
        );

        setError(
          `Gagal mengambil data pengguna: ${profileError.message}`
        );

        return;
      }

      setUsers((data || []) as UserProfile[]);
    } catch (err) {
      console.error("Users error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data pengguna."
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD ROLES
  // =====================================================

  async function loadRoles() {
    try {
      setLoadingRoles(true);

      const { data, error: roleError } =
        await supabase
          .from("roles")
          .select(`
            id,
            name,
            description
          `)
          .order("id", {
            ascending: true,
          });

      if (roleError) {
        console.error(
          "GAGAL MENGAMBIL ROLES:",
          roleError
        );

        setError(
          `Gagal mengambil data role: ${roleError.message}`
        );

        return;
      }

      setRoles((data || []) as Role[]);
    } catch (err) {
      console.error("Roles error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengambil data role."
      );
    } finally {
      setLoadingRoles(false);
    }
  }

  // =====================================================
  // ROLE LABEL
  // =====================================================

  function getRoleLabel(roleName?: string | null) {
    if (!roleName) {
      return "Role Tidak Dikenal";
    }

    return (
      roleDisplayNames[roleName] ||
      roleName
    );
  }

  // =====================================================
  // ROLE BADGE
  // =====================================================

  function getRoleBadge(roleName?: string | null) {
    switch (roleName) {
      case "super_admin":
        return "bg-purple-100 text-purple-700";

      case "admin_operator":
        return "bg-blue-100 text-blue-700";

      case "admin_uk":
        return "bg-indigo-100 text-indigo-700";

      case "asesor":
        return "bg-orange-100 text-orange-700";

      case "peserta":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  // =====================================================
  // CREATE FORM
  // =====================================================

  function resetForm() {
    setForm({
      nip: "",
      full_name: "",
      email: "",
      role_id: "",
      password: "",
    });
  }

  function handleCloseModal() {
    if (saving) return;

    setShowModal(false);
    resetForm();
  }

  // =====================================================
  // CREATE USER
  // =====================================================

  async function handleCreateUser() {
    try {
      setSaving(true);
      setError("");

      if (!form.full_name.trim()) {
        alert("Nama lengkap wajib diisi.");
        return;
      }

      if (!form.email.trim()) {
        alert("Email wajib diisi.");
        return;
      }

      if (!form.role_id) {
        alert("Role wajib dipilih.");
        return;
      }

      if (!form.password) {
        alert("Password wajib diisi.");
        return;
      }

      if (form.password.length < 6) {
        alert("Password minimal 6 karakter.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert(
          "Sesi login sudah berakhir. Silakan login kembali."
        );

        window.location.href = "/login";

        return;
      }

      const { data, error } =
        await supabase.functions.invoke(
          "create-user",
          {
            body: {
              nip:
                form.nip.trim() || null,

              full_name:
                form.full_name.trim(),

              email:
                form.email
                  .trim()
                  .toLowerCase(),

              role_id:
                Number(form.role_id),

              password:
                form.password,
            },
          }
        );

      if (error) {
        console.error(
          "CREATE USER ERROR:",
          error
        );

        alert(
          error.message ||
            "Gagal membuat pengguna."
        );

        return;
      }

      if (!data?.success) {
        alert(
          data?.error ||
            "Gagal membuat pengguna."
        );

        return;
      }

      alert(
        `Pengguna ${form.full_name} berhasil dibuat.`
      );

      setShowModal(false);

      resetForm();

      await loadUsers();
    } catch (err) {
      console.error(
        "Create user error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat membuat pengguna."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // BUKA EDIT
  // =====================================================

  function handleEdit(user: UserProfile) {
    setSelectedUser(user);

    setEditForm({
      nip:
        user.nip || "",

      full_name:
        user.full_name || "",

      role_id:
        String(user.role_id),
    });

    setShowEditModal(true);
  }

  // =====================================================
  // UPDATE USER
  // =====================================================

  async function handleUpdateUser() {
    if (!selectedUser) return;

    try {
      setSaving(true);
      setError("");

      if (!editForm.full_name.trim()) {
        alert("Nama lengkap wajib diisi.");
        return;
      }

      if (!editForm.role_id) {
        alert("Role wajib dipilih.");
        return;
      }

      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        alert(
          "Sesi login tidak valid. Silakan login kembali."
        );

        window.location.href = "/login";

        return;
      }

      const { error: updateError } =
        await supabase
          .from("profiles")
          .update({
            nip:
              editForm.nip.trim() || null,

            full_name:
              editForm.full_name.trim(),

            role_id:
              Number(editForm.role_id),

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            selectedUser.id
          );

      if (updateError) {
        console.error(
          "UPDATE USER ERROR:",
          updateError
        );

        alert(
          `Gagal memperbarui pengguna: ${updateError.message}`
        );

        return;
      }

      alert(
        `Data ${editForm.full_name} berhasil diperbarui.`
      );

      setShowEditModal(false);
      setSelectedUser(null);

      await loadUsers();
    } catch (err) {
      console.error(
        "Update user error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memperbarui pengguna."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // AKTIF / NONAKTIF
  // =====================================================

  async function handleToggleActive(
    user: UserProfile
  ) {
    const newStatus =
      !user.is_active;

    const action =
      newStatus
        ? "mengaktifkan"
        : "menonaktifkan";

    const confirmation =
      window.confirm(
        `Apakah Anda yakin ingin ${action} pengguna "${user.full_name}"?`
      );

    if (!confirmation) {
      return;
    }

    try {
      setUpdatingId(user.id);
      setError("");

      const {
        data: { user: currentUser },
      } =
        await supabase.auth.getUser();

      if (!currentUser) {
        alert(
          "Sesi login sudah berakhir. Silakan login kembali."
        );

        window.location.href =
          "/login";

        return;
      }

      // =================================================
      // JANGAN BOLEHKAN USER MENONAKTIFKAN DIRI SENDIRI
      // =================================================

      if (
        user.id === currentUser.id &&
        !newStatus
      ) {
        alert(
          "Anda tidak dapat menonaktifkan akun sendiri."
        );

        return;
      }

      const {
        error: updateError,
      } = await supabase
        .from("profiles")
        .update({
          is_active:
            newStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          user.id
        );

      if (updateError) {
        console.error(
          "TOGGLE USER ERROR:",
          updateError
        );

        alert(
          `Gagal ${action} pengguna: ${updateError.message}`
        );

        return;
      }

      alert(
        newStatus
          ? `Pengguna ${user.full_name} berhasil diaktifkan.`
          : `Pengguna ${user.full_name} berhasil dinonaktifkan.`
      );

      await loadUsers();
    } catch (err) {
      console.error(
        "Toggle user error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : `Terjadi kesalahan saat ${action} pengguna.`
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    window.location.href =
      "/login";
  }

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalUsers =
    users.length;

  const superAdminCount =
    users.filter(
      (user) =>
        user.roles?.name ===
        "super_admin"
    ).length;

  const adminOperatorCount =
    users.filter(
      (user) =>
        user.roles?.name ===
        "admin_operator"
    ).length;

  const adminUkCount =
    users.filter(
      (user) =>
        user.roles?.name ===
        "admin_uk"
    ).length;

  const asesorCount =
    users.filter(
      (user) =>
        user.roles?.name ===
        "asesor"
    ).length;

  const pesertaCount =
    users.filter(
      (user) =>
        user.roles?.name ===
        "peserta"
    ).length;

  // =====================================================
  // RENDER
  // =====================================================

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
              Manajemen
            </p>

            <p className="mt-1 font-semibold text-gray-900">
              Pengguna
            </p>

            <p className="mt-1 text-xs text-blue-600">
              Kelola akun sistem
            </p>

          </div>

          <nav className="space-y-1">

            <Link
              href="/"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            <Link
              href="/users"
              className="block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
            >
              Pengguna
            </Link>

            <Link
              href="/participants"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Peserta
            </Link>

            <Link
              href="/assessors"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Asesor
            </Link>

            <Link
              href="/competency-tests"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Uji Kompetensi
            </Link>

            <Link
              href="/question-bank"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Bank Soal
            </Link>

            <Link
              href="/schedules"
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Jadwal Ujian
            </Link>

          </nav>

        </aside>

        {/* CONTENT */}

        <section className="flex-1 p-6">

          {/* TITLE */}

          <div className="mb-6 flex items-center justify-between">

            <div>

              <h2 className="text-2xl font-bold text-gray-900">
                Manajemen Pengguna
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Kelola akun pengguna dan hak akses sistem.
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                setShowModal(true)
              }
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Tambah Pengguna
            </button>

          </div>

          {/* SUMMARY */}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

            <SummaryCard
              title="Total Pengguna"
              value={totalUsers}
            />

            <SummaryCard
              title="Super Admin"
              value={superAdminCount}
            />

            <SummaryCard
              title="Admin Operator"
              value={adminOperatorCount}
            />

            <SummaryCard
              title="Admin UJK"
              value={adminUkCount}
            />

            <SummaryCard
              title="Asesor"
              value={asesorCount}
            />

            <SummaryCard
              title="Peserta"
              value={pesertaCount}
            />

          </div>

          {/* ERROR */}

          {error && (

            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">

              <p className="text-sm font-medium text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={loadInitialData}
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Coba Lagi
              </button>

            </div>

          )}

          {/* TABLE */}

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

            <div className="flex items-center justify-between border-b px-6 py-4">

              <div>

                <h3 className="font-semibold text-gray-900">
                  Daftar Pengguna
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Daftar seluruh pengguna yang terdaftar dalam sistem.
                </p>

              </div>

              <button
                type="button"
                onClick={loadUsers}
                disabled={loading}
                className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                {loading
                  ? "Memuat..."
                  : "↻ Refresh"}
              </button>

            </div>

            {loading ? (

              <div className="p-10 text-center">

                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

                <p className="mt-4 text-sm text-gray-500">
                  Memuat data pengguna...
                </p>

              </div>

            ) : users.length === 0 ? (

              <div className="p-10 text-center">

                <p className="text-sm font-medium text-gray-700">
                  Belum ada pengguna.
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Silakan tambahkan pengguna baru.
                </p>

              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="min-w-full text-sm">

                  <thead className="bg-gray-50">

                    <tr>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        No
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        NIP
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Nama Lengkap
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Role
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Status
                      </th>

                      <th className="px-6 py-4 text-left font-semibold text-gray-600">
                        Aksi
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y">

                    {users.map(
                      (
                        item,
                        index
                      ) => (

                        <tr
                          key={item.id}
                          className="hover:bg-gray-50"
                        >

                          <td className="px-6 py-4 text-gray-500">
                            {index + 1}
                          </td>

                          <td className="px-6 py-4 font-mono text-sm text-gray-700">
                            {item.nip || "-"}
                          </td>

                          <td className="px-6 py-4 font-medium text-gray-900">
                            {item.full_name || "-"}
                          </td>

                          <td className="px-6 py-4">

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${getRoleBadge(
                                item.roles?.name
                              )}`}
                            >
                              {getRoleLabel(
                                item.roles?.name
                              )}
                            </span>

                          </td>

                          <td className="px-6 py-4">

                            {item.is_active ? (

                              <span className="font-medium text-green-600">
                                ● Aktif
                              </span>

                            ) : (

                              <span className="font-medium text-red-600">
                                ● Tidak Aktif
                              </span>

                            )}

                          </td>

                          <td className="px-6 py-4">

                            <div className="flex gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  handleEdit(
                                    item
                                  )
                                }
                                className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleActive(
                                    item
                                  )
                                }
                                disabled={
                                  updatingId ===
                                  item.id
                                }
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                                  item.is_active
                                    ? "border-red-200 text-red-600 hover:bg-red-50"
                                    : "border-green-200 text-green-600 hover:bg-green-50"
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                              >
                                {updatingId ===
                                item.id
                                  ? "Memproses..."
                                  : item.is_active
                                  ? "Nonaktifkan"
                                  : "Aktifkan"}
                              </button>

                            </div>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </section>

      </div>

      {/* =====================================================
          MODAL TAMBAH
      ===================================================== */}

      {showModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b px-6 py-4">

              <div>

                <h3 className="text-lg font-bold text-gray-900">
                  Tambah Pengguna
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Buat akun pengguna baru untuk sistem LSP-PDN.
                </p>

              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                disabled={saving}
                className="text-2xl leading-none text-gray-400 hover:text-gray-700 disabled:opacity-50"
              >
                ×
              </button>

            </div>

            <div className="space-y-4 px-6 py-5">

              <InputField
                label="NIP"
                value={form.nip}
                placeholder="Masukkan NIP"
                onChange={(value) =>
                  setForm({
                    ...form,
                    nip: value,
                  })
                }
              />

              <InputField
                label="Nama Lengkap"
                value={form.full_name}
                placeholder="Masukkan nama lengkap"
                onChange={(value) =>
                  setForm({
                    ...form,
                    full_name: value,
                  })
                }
              />

              <InputField
                label="Email"
                type="email"
                value={form.email}
                placeholder="contoh@email.com"
                onChange={(value) =>
                  setForm({
                    ...form,
                    email: value,
                  })
                }
              />

              {/* ROLE */}

              <div>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Role
                </label>

                <select
                  value={
                    form.role_id
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role_id:
                        e.target.value,
                    })
                  }
                  disabled={
                    loadingRoles
                  }
                  className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                >

                  <option value="">
                    {loadingRoles
                      ? "Memuat role..."
                      : "Pilih Role"}
                  </option>

                  {roles.map(
                    (role) => (

                      <option
                        key={role.id}
                        value={
                          role.id
                        }
                      >
                        {getRoleLabel(
                          role.name
                        )}
                      </option>

                    )
                  )}

                </select>

              </div>

              {/* PASSWORD DENGAN TOMBOL MATA */}

              <InputField
                label="Password"
                type="password"
                value={
                  form.password
                }
                placeholder="Minimal 6 karakter"
                showPasswordToggle
                onChange={(value) =>
                  setForm({
                    ...form,
                    password:
                      value,
                  })
                }
              />

            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">

              <button
                type="button"
                onClick={
                  handleCloseModal
                }
                disabled={
                  saving
                }
                className="rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={
                  handleCreateUser
                }
                disabled={
                  saving ||
                  loadingRoles
                }
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Menyimpan..."
                  : "Simpan Pengguna"}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          MODAL EDIT
      ===================================================== */}

      {showEditModal &&
        selectedUser && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

              <div className="flex items-center justify-between border-b px-6 py-4">

                <div>

                  <h3 className="text-lg font-bold text-gray-900">
                    Edit Pengguna
                  </h3>

                  <p className="mt-1 text-xs text-gray-500">
                    Perbarui data pengguna.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => {

                    if (
                      !saving
                    ) {

                      setShowEditModal(
                        false
                      );

                      setSelectedUser(
                        null
                      );

                    }

                  }}
                  disabled={
                    saving
                  }
                  className="text-2xl leading-none text-gray-400 hover:text-gray-700"
                >
                  ×
                </button>

              </div>

              <div className="space-y-4 px-6 py-5">

                <InputField
                  label="NIP"
                  value={
                    editForm.nip
                  }
                  placeholder="Masukkan NIP"
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      nip: value,
                    })
                  }
                />

                <InputField
                  label="Nama Lengkap"
                  value={
                    editForm.full_name
                  }
                  placeholder="Masukkan nama lengkap"
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      full_name:
                        value,
                    })
                  }
                />

                {/* ROLE */}

                <div>

                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Role
                  </label>

                  <select
                    value={
                      editForm.role_id
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        role_id:
                          e.target.value,
                      })
                    }
                    disabled={
                      loadingRoles
                    }
                    className="w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                  >

                    {roles.map(
                      (role) => (

                        <option
                          key={
                            role.id
                          }
                          value={
                            role.id
                          }
                        >
                          {getRoleLabel(
                            role.name
                          )}
                        </option>

                      )
                    )}

                  </select>

                </div>

                {/* STATUS */}

                <div className="rounded-lg bg-gray-50 p-3">

                  <p className="text-xs text-gray-500">
                    Status akun saat ini
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {selectedUser.is_active
                      ? "Aktif"
                      : "Tidak Aktif"}
                  </p>

                </div>

              </div>

              <div className="flex justify-end gap-3 border-t px-6 py-4">

                <button
                  type="button"
                  onClick={() => {

                    if (
                      !saving
                    ) {

                      setShowEditModal(
                        false
                      );

                      setSelectedUser(
                        null
                      );

                    }

                  }}
                  disabled={
                    saving
                  }
                  className="rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={
                    handleUpdateUser
                  }
                  disabled={
                    saving ||
                    loadingRoles
                  }
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Menyimpan..."
                    : "Simpan Perubahan"}
                </button>

              </div>

            </div>

          </div>

        )}

    </main>
  );
}

// =========================================================
// INPUT FIELD
// =========================================================

function InputField({
  label,
  value,
  placeholder,
  type = "text",
  showPasswordToggle = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  showPasswordToggle?: boolean;
  onChange: (
    value: string
  ) => void;
}) {
  const [showPassword, setShowPassword] =
    useState(false);

  const inputType =
    type === "password" &&
    showPasswordToggle
      ? showPassword
        ? "text"
        : "password"
      : type;

  return (

    <div>

      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div className="relative">

        <input
          type={inputType}
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value
            )
          }
          placeholder={
            placeholder
          }
          className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
            showPasswordToggle
              ? "pr-11"
              : ""
          }`}
        />

        {showPasswordToggle &&
          type === "password" && (

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
              aria-label={
                showPassword
                  ? "Sembunyikan password"
                  : "Tampilkan password"
              }
              title={
                showPassword
                  ? "Sembunyikan password"
                  : "Tampilkan password"
              }
            >
              {showPassword
                ? "🙈"
                : "👁️"}
            </button>

          )}

      </div>

    </div>

  );
}

// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {

  return (

    <div className="rounded-xl border bg-white p-4 shadow-sm">

      <p className="text-xs text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>

    </div>

  );
}