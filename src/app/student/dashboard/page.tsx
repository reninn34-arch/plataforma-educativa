"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  BookOpen,
  Flame,
  Clock,
  CheckCircle2,
  ClipboardList,
  Gamepad2,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SUBJECTS } from "@/lib/utils";
import { DueTimer } from "@/components/DueTimer";
import { apiFetch } from "@/lib/fetch-utils";

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

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
      <p className="text-muted-foreground">Cargando...</p>
    </div>
  );

  if (!data) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-muted-foreground">Error al cargar dashboard</p>
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
  const expiredAssignments = assignments.filter((a: any) => {
    if (a.status === "graded" || a.status === "submitted") return false;
    return a.dueDate && new Date(a.dueDate).getTime() < Date.now();
  });
  const submittedAssignments = assignments.filter((a: any) => a.status === "submitted" || a.status === "graded");
  const totalSessions = metrics?.totalSessions || 0;
  const accuracy = metrics?.accuracy || 0;
  const streakDays = metrics?.streakDays || 0;

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-5xl mx-auto space-y-10 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vision General</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bienvenido de vuelta, {profile?.fullName || "Estudiante"}. Aqui tienes un resumen de tu actividad academica.
          </p>
        </div>
      </div>

      {/* SECTION 1: TUS EVALUACIONES */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-foreground" />
          <h2 className="text-base font-bold tracking-tight">Tus Evaluaciones</h2>
          <span className="text-[11px] text-muted-foreground font-normal ml-1">
            — Estas son tus notas oficiales, enviadas por tus docentes
          </span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Tareas asignadas</p>
              <p className="text-2xl font-bold">{assignments.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Pendientes</p>
              <p className="text-2xl font-bold">{pendingAssignments.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-red-400">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Vencidas</p>
              <p className="text-2xl font-bold">{expiredAssignments.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Entregadas</p>
              <p className="text-2xl font-bold">{submittedAssignments.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Active pending assignments */}
        <Card className="shadow-sm">
          <CardContent className="p-0">
            {pendingAssignments.length > 0 ? (
              <div className="divide-y">
                {pendingAssignments.slice(0, 5).map((a) => {
                  return (
                    <Link
                      key={a.id}
                      href={`/student/assignments/${a.id}`}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center bg-amber-100 text-amber-600 text-sm">
                          {a.subjectEmoji || "📋"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.subjectName}</p>
                          {a.dueDate && (
                            <div className="mt-0.5">
                              <DueTimer dueDate={a.dueDate} compact />
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">No tienes tareas pendientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <Link
            href="/student/assignments"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            Ver todas mis tareas <ArrowRight className="h-3 w-3" />
          </Link>
          {expiredAssignments.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {expiredAssignments.length} {expiredAssignments.length === 1 ? "tarea vencida" : "tareas vencidas"}
            </span>
          )}
        </div>

      </section>

      {/* Divider */}
      <div className="border-t border-dashed" />

      {/* SECTION 2: PRACTICA CON IA */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold tracking-tight">Practica con IA</h2>
          <span className="text-[11px] text-muted-foreground font-normal ml-1">
            — Refuerzo voluntario. No afecta tu nota oficial.
          </span>
        </div>

        {/* Practice stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <Flame className="h-4 w-4 text-orange-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{totalSessions}</p>
              <p className="text-[10px] text-muted-foreground">Sesiones</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{streakDays} dias</p>
              <p className="text-[10px] text-muted-foreground">Racha</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="p-3 text-center">
              <BookOpen className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{accuracy}%</p>
              <p className="text-[10px] text-muted-foreground">Precision</p>
              <p className="text-[9px] text-muted-foreground/60">Aciertos / Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Subject cards */}
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.entries(progress).map(([slug, p]) => {
            const subjDef = SUBJECTS.find(s => s.id === slug);
            const name = subjDef?.name || slug;
            const emoji = subjDef?.emoji || "📚";
            const pct = p.percentage ?? 0;
            const completed = p.completedNodes ?? 0;
            const total = p.totalNodes ?? 0;
            const stars = p.totalStars ?? 0;
            return (
              <Link
                key={slug}
                href={`/student/path/${slug}`}
                className="flex items-center gap-4 p-4 bg-card border rounded-xl hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-2xl">
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{name}</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="mt-2">
                    <ProgressBar percentage={pct} />
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[11px] text-muted-foreground">
                      {total > 0 ? `${completed}/${total} nodos` : "Sin progreso"}
                    </p>
                    {stars > 0 && (
                      <span className="text-[11px] text-yellow-600 font-medium flex items-center gap-0.5">
                        ⭐ {stars}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

    </div>
  );
}