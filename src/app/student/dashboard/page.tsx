"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  BookOpen,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Gamepad2,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SUBJECTS } from "@/lib/utils";
import { DueTimer } from "@/components/DueTimer";

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

export default function StudentDashboard() {
  const [userName, setUserName] = useState("");
  const [progress, setProgress] = useState<Record<string, { percentage: number; completedNodes: number; totalNodes: number; totalStars: number }>>({});
  const [streakDays, setStreakDays] = useState(0);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then(r => r.json())
      .then(d => {
        if (d.fullName) setUserName(d.fullName);
      })
      .catch(() => setUserName("Estudiante"));

    fetch("/api/student/progress")
      .then(r => r.json())
      .then(d => setProgress(d))
      .catch(() => {});

    fetch("/api/assignments?role=student")
      .then(r => r.json())
      .then(d => { if (d.assignments) setAssignments(d.assignments); })
      .catch(() => {});

    fetch("/api/student/metrics")
      .then(r => r.json())
      .then(d => {
        setMetrics(d);
        if (d.totalSessions > 0) setStreakDays(d.streakDays ?? 0);
      })
      .catch(() => {});
  }, []);

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
  const gradeAverage = metrics?.gradeAverage;

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-5xl mx-auto space-y-10 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vision General</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bienvenido de vuelta, {userName}. Aqui tienes un resumen de tu actividad academica.
          </p>
        </div>
      </div>

      {/* ============================================
          SECTION 1: TUS EVALUACIONES (OFICIAL)
          ============================================ */}
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
          <Card className="shadow-sm border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Promedio oficial</p>
              <p className="text-2xl font-bold">
                {gradeAverage != null ? `${gradeAverage}%` : "--"}
              </p>
              {gradeAverage == null && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Sin notas aun</p>
              )}
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

        <div>
          <Link
            href="/student/grades"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            Ver todas mis calificaciones <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-dashed" />

      {/* ============================================
          SECTION 2: PRACTICA CON IA (VOLUNTARIO)
          ============================================ */}
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
          {SUBJECTS.map((subject) => {
            const p = progress[subject.id];
            const pct = p?.percentage ?? 0;
            const completed = p?.completedNodes ?? 0;
            const total = p?.totalNodes ?? 0;
            const stars = p?.totalStars ?? 0;
            return (
              <Link
                key={subject.id}
                href={`/student/path/${subject.id}`}
                className="flex items-center gap-4 p-4 bg-card border rounded-xl hover:border-primary/40 hover:shadow-md transition-all group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-2xl">
                  {subject.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{subject.name}</h3>
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
