"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, BookOpen, ArrowRight, Sparkles, Activity, UserCheck, UserX } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/fetch-utils";

interface AdminDashboardData {
  profile: { id: number; fullName: string; cedula: string; role: string; email?: string } | null;
  stats: { totalEstudiantes: number; totalProfesores: number; totalPadres: number; totalCursos: number };
  courses: any[];
  teachers: any[];
  subjects: any[];
  chartData: {
    roles: { name: string; value: number; color: string }[];
    activos: number;
    inactivos: number;
  };
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
  const chartData = data?.chartData || { roles: [], activos: 0, inactivos: 0 };
  const firstName = data?.profile?.fullName?.split(" ")[0] || "Admin";
  const courses = data?.courses || [];

  const statusData = [
    { name: "Activos", value: chartData.activos, color: "#22c55e" },
    { name: "Inactivos", value: chartData.inactivos, color: "#ef4444" },
  ];

  const studentsPerCourse = courses
    .filter((c: any) => (c.studentCount || 0) > 0)
    .slice(0, 10)
    .map((c: any) => ({
      name: c.nombre.length > 15 ? c.nombre.slice(0, 15) + "..." : c.nombre,
      estudiantes: c.studentCount || 0,
    }));

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-8">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-card/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Panel de Administración
            </h1>
            <p className="text-indigo-200 mt-2 max-w-lg">
              Gestiona la institución, usuarios y cursos. Bienvenido, {firstName}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estudiantes</p>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <GraduationCap size={20} className="text-blue-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-foreground">{stats.totalEstudiantes}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profesores</p>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Users size={20} className="text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-foreground">{stats.totalProfesores}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Padres</p>
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Users size={20} className="text-violet-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-foreground">{stats.totalPadres}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cursos activos</p>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <BookOpen size={20} className="text-amber-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-foreground">{stats.totalCursos}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-indigo-500" />
              <h2 className="text-base font-bold text-foreground">Usuarios por rol</h2>
            </div>
            {chartData.roles.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={chartData.roles}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {chartData.roles.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {chartData.roles.map((r) => (
                    <div key={r.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-muted-foreground">{r.name}</span>
                      <span className="font-semibold text-foreground ml-auto">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Sin datos</p>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-emerald-500" />
              <h2 className="text-base font-bold text-foreground">Estado de usuarios</h2>
            </div>
            {statusData.some(d => d.value > 0) ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <UserCheck size={16} className="text-green-500" />
                    <span className="text-muted-foreground">Activos</span>
                    <span className="font-semibold text-foreground ml-auto">{chartData.activos}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <UserX size={16} className="text-red-500" />
                    <span className="text-muted-foreground">Inactivos</span>
                    <span className="font-semibold text-foreground ml-auto">{chartData.inactivos}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Sin datos</p>
            )}
          </div>
        </div>

        {studentsPerCourse.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={18} className="text-amber-500" />
              <h2 className="text-base font-bold text-foreground">Estudiantes por curso (top 10)</h2>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={studentsPerCourse}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip />
                <Bar dataKey="estudiantes" fill="#818cf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-500" />
            Acceso rápido
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push("/admin/usuarios")}
              className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mb-3 shadow-md shadow-blue-200">
                    <Users size={24} />
                  </div>
                  <h3 className="font-bold text-foreground">Gestionar Usuarios</h3>
                  <p className="text-xs text-slate-400 mt-1">Crear, ver y eliminar estudiantes y profesores</p>
                </div>
                <ArrowRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </button>
            <button
              onClick={() => router.push("/admin/cursos")}
              className="bg-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white mb-3 shadow-md shadow-amber-200">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="font-bold text-foreground">Gestionar Cursos</h3>
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
