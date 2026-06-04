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
        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-200/50">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-3">
                <Sparkles size={12} />
                Panel del Profesor
              </div>

              {selectedCurso ? (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => router.push("/teacher/dashboard")}
                      className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-all"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{selectedCurso.nombre}</h1>
                    <span className="text-xs font-medium bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-lg">{selectedCurso.nivel}</span>
                  </div>
                  {selectedCurso.mySubjects?.length > 0 && (
                    <div className="flex gap-1.5 mt-3">
                      {selectedCurso.mySubjects.map((s: any, i: number) => (
                        <span key={i} className="text-[10px] font-medium bg-white/15 backdrop-blur-sm text-indigo-100 px-2 py-0.5 rounded-lg">
                          {s.subjectEmoji} {s.subjectName}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Panel Principal
                  </h1>
                  <p className="text-indigo-100 text-sm sm:text-base mt-2 max-w-lg leading-relaxed">
                    Monitorea el progreso de tus estudiantes
                  </p>
                </>
              )}

              {activePeriod && (
                <div className="flex items-center gap-1.5 mt-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium bg-white/15 backdrop-blur-sm text-indigo-100 px-2.5 py-1 rounded-lg border border-white/20">
                    📅 {activePeriod.nombre}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {cursos.length > 1 && (
                <select
                  value={cursoId || ""}
                  onChange={e => {
                    if (e.target.value) router.push(`/teacher/dashboard?cursoId=${e.target.value}`);
                    else router.push("/teacher/dashboard");
                  }}
                  className="h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 px-3 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <option value="" className="text-slate-800">Todos los cursos</option>
                  {cursos.map((c: any) => (
                    <option key={c.id} value={c.id} className="text-slate-800">{c.nombre} ({c.nivel})</option>
                  ))}
                </select>
              )}
              <a
                href="/api/analytics/export"
                download
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
              >
                <Download size={16} />
                Exportar
              </a>
            </div>
          </div>
        </section>

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
