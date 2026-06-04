"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Brain, Target, Play } from "lucide-react";
import { SUBJECTS } from "@/lib/utils";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

function ProgressBar({ percentage, color = "bg-indigo-500" }: { percentage: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
      <div
        className={`h-full rounded-full relative overflow-hidden transition-all duration-700 ease-out ${color}`}
        style={{ width: `${percentage}%` }}
      >
        <div className="absolute inset-0 bg-white/20 animate-shimmer" />
      </div>
    </div>
  );
}

interface DashboardData {
  progress: Record<string, { percentage: number; completedNodes: number; totalNodes: number; totalStars: number }>;
}

export default function PracticePage() {
  const { data, isLoading } = useQuery<DashboardData, Error>({
    queryKey: ["student-dashboard"],
    queryFn: async () => {
      const res = await apiFetch("/api/dashboard/student");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando materias...</p>
      </div>
    </div>
  );

  const progress = data?.progress || {};

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 pb-24 lg:pb-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-200/50">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-3">
                <Brain size={12} />
                Práctica con IA
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Elige una materia
              </h1>
              <p className="text-indigo-100 text-sm sm:text-base mt-2 max-w-lg leading-relaxed">
                Refuerza tus conocimientos con ejercicios personalizados generados por inteligencia artificial.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-indigo-200 text-sm">
              <Target size={16} />
              {Object.keys(progress).length} materias disponibles
            </div>
          </div>
        </section>

        {/* Subject Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.keys(progress).length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <BookOpen size={32} className="text-slate-300" />
              </div>
              <p className="font-semibold text-slate-600">Aún no tienes materias disponibles</p>
              <p className="text-sm text-slate-400 mt-1">Los docentes asignarán materias próximamente</p>
            </div>
          ) : (
            Object.entries(progress).map(([slug, p]) => {
              const subjDef = SUBJECTS.find(s => s.id === slug);
              const name = subjDef?.name || slug;
              const emoji = subjDef?.emoji || "📚";
              const theme = subjectTheme(slug);
              const pct = Number(p.percentage) || 0;
              const completed = Number(p.completedNodes) || 0;
              const total = p.totalNodes ?? 0;
              const stars = p.totalStars ?? 0;

              return (
                <Link
                  key={slug}
                  href={`/student/path/${slug}`}
                  className="group bg-white rounded-2xl p-5 border border-slate-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-14 h-14 rounded-2xl ${theme.bgLight} flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-200`}>
                      {emoji}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {stars > 0 && (
                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                          ⭐ {stars}
                        </span>
                      )}
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition-colors">
                        <Play size={16} className="fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">{name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 mb-4">
                    {total > 0 ? `${completed}/${total} nodos completados` : "Sin empezar"}
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-400">Progreso</span>
                      <span className={theme.text}>{pct}%</span>
                    </div>
                    <ProgressBar percentage={pct} color={`bg-gradient-to-r ${theme.gradient}`} />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
