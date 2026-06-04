"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

interface AdminDashboardData {
  profile: { id: number; fullName: string; cedula: string; role: string; email?: string } | null;
  stats: { totalEstudiantes: number; totalProfesores: number; totalPadres: number; totalCursos: number };
  courses: any[];
  teachers: any[];
  subjects: any[];
}

export default function AdminDashboard() {
  const router = useRouter();

  const { data, isLoading } = useQuery<AdminDashboardData, Error>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await apiFetch("/api/dashboard/admin");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando panel...</p>
      </div>
    </div>
  );

  const stats = data?.stats || { totalEstudiantes: 0, totalProfesores: 0, totalPadres: 0, totalCursos: 0 };
  const firstName = data?.profile?.fullName?.split(" ")[0] || "Admin";

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-8">
        {/* Hero */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Panel de Administración
            </h1>
            <p className="text-indigo-200 mt-2 max-w-lg">
              Gestiona la institución, usuarios y cursos. Bienvenido, {firstName}.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estudiantes</p>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <GraduationCap size={20} className="text-blue-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-800">{stats.totalEstudiantes}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profesores</p>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Users size={20} className="text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-800">{stats.totalProfesores}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Padres</p>
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Users size={20} className="text-violet-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-800">{stats.totalPadres}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cursos activos</p>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <BookOpen size={20} className="text-amber-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-800">{stats.totalCursos}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-500" />
            Acceso rápido
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push("/admin/usuarios")}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mb-3 shadow-md shadow-blue-200">
                    <Users size={24} />
                  </div>
                  <h3 className="font-bold text-slate-800">Gestionar Usuarios</h3>
                  <p className="text-xs text-slate-400 mt-1">Crear, ver y eliminar estudiantes y profesores</p>
                </div>
                <ArrowRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </button>
            <button
              onClick={() => router.push("/admin/cursos")}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white mb-3 shadow-md shadow-amber-200">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="font-bold text-slate-800">Gestionar Cursos</h3>
                  <p className="text-xs text-slate-400 mt-1">Crear cursos, asignar profesores y matricular estudiantes</p>
                </div>
                <ArrowRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
