"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Flame,
  CheckCircle2,
  ClipboardList,
  Sparkles,
  Zap,
  Target,
  Brain,
  BookOpen,
} from "lucide-react";
import { DueTimer } from "@/components/DueTimer";
import { apiFetch } from "@/lib/fetch-utils";

interface DashboardData {
  profile: { id: number; fullName: string; cedula: string; role: string; email?: string } | null;
  progress: Record<string, { percentage: number; completedNodes: number; totalNodes: number; totalStars: number }>;
  metrics: {
    totalSessions: number; totalQuestions: number; totalCorrect: number; totalScore: number;
    bestScore: number; avgScore: number; accuracy: number; streakDays: number;
    gradeAverage: number | null; gradedCount: number; recentSessions: any[];
  };
  assignments: any[];
}

export default function StudentDashboard() {
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
        <div className="w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Cargando tu progreso...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">⚠️</span>
        </div>
        <p className="text-muted-foreground font-medium">Error al cargar el dashboard</p>
        <p className="text-sm text-muted-foreground mt-1">Intenta recargar la página</p>
      </div>
    </div>
  );

  const { profile, progress: rawProgress, metrics, assignments: rawAssignments } = data;
  const progress = rawProgress || {};
  const assignments = rawAssignments || [];
  const pendingAssignments = assignments.filter((a: any) => {
    if (a.status === "graded" || a.status === "submitted") return false;
    if (a.dueDate && new Date(a.dueDate).getTime() < Date.now()) return false;
    return true;
  });
  const totalSessions = metrics?.totalSessions || 0;
  const accuracy = metrics?.accuracy || 0;
  const streakDays = metrics?.streakDays || 0;
  const totalNodos = Object.values(progress).reduce((sum, p) => sum + (Number(p.completedNodes) || 0), 0);
  const firstName = profile?.fullName?.split(" ")[0] || "Estudiante";

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 pb-24 lg:pb-8">

        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--hero-gradient-from)] via-[var(--hero-gradient-via)] to-[var(--hero-gradient-to)] p-6 sm:p-8 text-white shadow-xl shadow-primary/20">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 dark:bg-white/5 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-card/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-3">
                <Sparkles size={12} />
                Panel del Estudiante
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                ¡Hola, {firstName}! 👋
              </h1>
              <p className="text-primary-foreground/90 text-sm sm:text-base mt-2 max-w-lg leading-relaxed">
                {streakDays > 0
                  ? `Llevas una racha de ${streakDays} días. ¡Sigue así para mantener el ritmo!`
                  : "Hoy es un gran día para empezar a practicar. ¡Ánimo!"}
              </p>
            </div>

            <Link
              href="/student/assignments"
              className="inline-flex items-center gap-2 bg-card text-foreground font-bold py-3 px-6 rounded-2xl hover:bg-muted hover:scale-[1.02] transition-all duration-200 shadow-lg shadow-[var(--active-link-border)]/50 dark:shadow-[var(--active-link-border)]/10 group shrink-0"
            >
              <div className="bg-[var(--active-link-border)] dark:bg-[var(--active-link-border)]/30 text-foreground p-1.5 rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <ClipboardList size={18} />
              </div>
              Ver tareas
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Quick Access to Practice */}
            <Link
              href="/student/practice"
              className="block group bg-gradient-to-r from-[var(--active-link-bg)] to-[var(--active-link-bg)] dark:from-[var(--active-link-bg)]/40 dark:to-[var(--active-link-bg)]/40 rounded-2xl p-4 sm:p-6 border border-[var(--active-link-border)] dark:border-[var(--active-link-border)]/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-3 sm:gap-5">
                <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-card-from)] to-[var(--accent-card-to)] flex items-center justify-center shadow-lg shadow-[var(--active-link-border)]/50 dark:shadow-primary/40 shrink-0">
                  <div className="absolute inset-0 rounded-2xl bg-card/20 animate-ping" />
                  <Brain size={24} className="relative z-10 text-white animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-foreground text-sm sm:text-lg">Práctica con IA</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                    {Object.keys(progress).length} materias · {totalNodos} nodos
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-3">
                    {Object.entries(progress).slice(0, 4).map(([slug, p]) => (
                      <span key={slug} className="text-xs bg-card border border-border rounded-lg px-1.5 py-0.5 text-muted-foreground">
                        {slug === "matematicas" && "🔢"}
                        {slug === "fisica" && "⚡"}
                        {slug === "quimica" && "🧪"}
                        {slug === "ingles" && "🗣"}
                        {Number(p.percentage) || 0}%
                      </span>
                    ))}
                  </div>
                </div>
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-xl bg-[var(--active-link-icon)]/30 dark:bg-[var(--active-link-icon)]/45 animate-ping group-hover:animate-none" />
                  <div className="relative z-10 bg-primary text-white p-2 sm:p-3 rounded-xl group-hover:bg-primary/95 transition-colors">
                    <ChevronRight size={18} />
                  </div>
                </div>
              </div>
            </Link>

            {/* Resumen académico */}
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                <BookOpen size={18} className="text-primary" />
                Resumen académico
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-muted rounded-xl p-3 text-center">
                  <Flame size={18} className="text-orange-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{streakDays}</p>
                  <p className="text-xs text-muted-foreground font-medium">Racha</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <Zap size={18} className="text-primary" />
                  <p className="text-lg font-bold text-foreground">{totalSessions}</p>
                  <p className="text-xs text-muted-foreground font-medium">Sesiones</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <Target size={18} className="text-emerald-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{accuracy}%</p>
                  <p className="text-xs text-muted-foreground font-medium">Precisión</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <BookOpen size={18} className="text-violet-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{Object.keys(progress).length}</p>
                  <p className="text-xs text-muted-foreground font-medium">Materias</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">

            {/* Pending Assignments */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground flex items-center gap-2 text-sm">
                    <ClipboardList size={18} className="text-primary" />
                    Pendientes
                  </h3>
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {pendingAssignments.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {pendingAssignments.length > 0 ? (
                  pendingAssignments.slice(0, 5).map((a: any) => (
                    <Link
                      key={a.id}
                      href={`/student/assignments/${a.id}`}
                      className="flex items-center gap-3 p-4 hover:bg-muted transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-base shrink-0">
                        {a.subjectEmoji || "📋"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.subjectName}</p>
                        {a.dueDate && (
                          <div className="mt-1">
                            <DueTimer dueDate={a.dueDate} compact />
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-muted-foreground transition-colors shrink-0" />
                    </Link>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <CheckCircle2 size={36} className="text-emerald-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">¡Todo al día!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">No tienes tareas pendientes</p>
                  </div>
                )}
              </div>
              {pendingAssignments.length > 0 && (
                <Link
                  href="/student/assignments"
                  className="block text-center text-xs font-semibold text-foreground py-3 hover:bg-accent transition-colors"
                >
                  Ver todas las tareas
                </Link>
              )}
            </div>

              {/* Tutor de Aprendizaje Card */}
              <div className="bg-gradient-to-br from-[var(--tutor-gradient-from)] to-[var(--tutor-gradient-to)] rounded-2xl p-5 text-white relative overflow-hidden group cursor-pointer shadow-md">
                <div className="absolute -right-6 -bottom-6 text-white/10 group-hover:scale-110 transition-transform duration-500">
                  <Brain size={120} />
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="w-11 h-11 rounded-2xl bg-card/15 backdrop-blur-sm flex items-center justify-center mb-3 border border-white/20">
                    <Brain size={22} className="text-white" />
                  </div>
                  <h3 className="font-bold text-lg">Tutor de Aprendizaje</h3>
                  <p className="text-white/90 text-sm mt-1 leading-relaxed">
                   No te damos respuestas. Te guiamos paso a paso para que aprendas resolviéndolo tú.
                 </p>
                 <div className="flex flex-wrap gap-1.5 mt-3">
                   <span className="inline-flex items-center gap-1 rounded-full bg-card/10 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-white border border-white/10">
                     🧮 Explicación paso a paso
                   </span>
                   <span className="inline-flex items-center gap-1 rounded-full bg-card/10 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-white border border-white/10">
                     💡 Pistas sin spoilers
                   </span>
                   <span className="inline-flex items-center gap-1 rounded-full bg-card/10 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-white border border-white/10">
                     ✅ Validación de intentos
                   </span>
                 </div>
                 <button
                   onClick={() => window.dispatchEvent(new CustomEvent("open-ai-assistant", { detail: { flow: "tutor" } }))}
                   className="mt-4 bg-card text-foreground font-semibold py-2.5 px-5 rounded-xl text-sm hover:bg-accent hover:scale-[1.02] transition-all shadow-md w-full text-center active:scale-95"
                 >
                   Iniciar tutoría
                 </button>
               </div>
             </div>

          </div>
        </div>
      </div>
    </div>
  );
}
