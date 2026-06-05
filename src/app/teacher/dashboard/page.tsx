"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { StudentsTable } from "@/components/teacher/StudentsTable";
import { Download, ArrowLeft, Sparkles, BookOpen } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

interface TeacherDashboardData {
  profile: { id: number; fullName: string; cedula: string; role: string; email?: string } | null;
  courses: any[];
  periods: any[];
  activePeriod: any | null;
  stats: { totalEstudiantes: number; pendientes: number; bajoRendimiento: number; promedioGeneral: number; totalCursos: number };
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cursoId = searchParams.get("cursoId") ? parseInt(searchParams.get("cursoId")!) : null;

  const { data } = useQuery<TeacherDashboardData, Error>({
    queryKey: ["teacher-dashboard"],
    queryFn: async () => {
      const res = await apiFetch("/api/dashboard/teacher");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const cursos = data?.courses || [];
  const activePeriod = data?.activePeriod || null;
  const selectedCurso = cursoId ? cursos.find((c: any) => c.id === cursoId) : null;

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              {selectedCurso ? (
                <>
                  <button
                    onClick={() => router.push("/teacher/dashboard")}
                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h1 className="text-xl font-bold text-slate-800">{selectedCurso.nombre}</h1>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{selectedCurso.nivel}</span>
                  {selectedCurso.mySubjects?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedCurso.mySubjects.map((s: any, i: number) => (
                        <span key={i} className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-100">
                          {s.subjectEmoji} {s.subjectName}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-800">Panel Principal</h1>
                    <p className="text-sm text-slate-500">Monitorea el progreso de tus estudiantes</p>
                  </div>
                </div>
              )}
            </div>
            {activePeriod && (
              <div className="flex items-center gap-1.5 mt-3">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                  📅 {activePeriod.nombre}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {cursos.length > 1 && (
              <select
                value={cursoId || ""}
                onChange={e => {
                  if (e.target.value) router.push(`/teacher/dashboard?cursoId=${e.target.value}`);
                  else router.push("/teacher/dashboard");
                }}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              >
                <option value="">Todos los cursos</option>
                {cursos.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.nivel})</option>
                ))}
              </select>
            )}
            <a
              href="/api/analytics/export"
              download
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Download size={16} />
              Exportar
            </a>
          </div>
        </div>

        {/* Course pills — quick course selector when on "all" view */}
        {!cursoId && cursos.length > 0 && (
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-indigo-500 shrink-0" />
            <div className="flex flex-wrap gap-2">
              {cursos.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/teacher/dashboard?cursoId=${c.id}`)}
                  className="text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-100 transition-all"
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Students Table — includes stats, search, and table */}
        <StudentsTable cursoId={cursoId} />
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Cargando panel...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
