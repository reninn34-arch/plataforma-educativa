"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Award, TrendingUp, BarChart3, CheckCircle, Clock, AlertCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentBottomNav } from "@/components/StudentBottomNav";
import { apiFetch } from "@/lib/fetch-utils";

interface GradeRow {
  id: number;
  assignmentId: number;
  assignmentTitle: string;
  subjectName: string;
  subjectEmoji: string;
  trimester: number;
  grade: number | null;
  feedback: string | null;
  status: string;
  submittedAt: string;
}

interface SubjectSummary {
  subjectName: string;
  subjectEmoji: string;
  t1Avg: number | null;
  t2Avg: number | null;
  t3Avg: number | null;
  yearlyAvg: number | null;
  totalGraded: number;
}

const TRIMESTER_NAMES: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };

export default function StudentGradesPage() {
  const router = useRouter();
  const [graded, setGraded] = useState<GradeRow[]>([]);
  const [pending, setPending] = useState<GradeRow[]>([]);
  const [notSubmittedCount, setNotSubmittedCount] = useState(0);
  const [summary, setSummary] = useState<SubjectSummary[]>([]);
  const [generalAvg, setGeneralAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "summary">("tasks");

  useEffect(() => {
    apiFetch("/api/student/grades")
      .then(r => r.json())
      .then(d => {
        setGraded(d.graded || []);
        setPending(d.pending || []);
        setNotSubmittedCount(d.notSubmittedCount || 0);
        setSummary(d.summary || []);
        setGeneralAvg(d.generalAvg);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Cargando...</p>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4 max-w-3xl mx-auto w-full">
          <Button variant="ghost" size="icon" onClick={() => router.push("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" /> Mis Calificaciones
          </span>
          {generalAvg !== null && (
            <Badge variant={generalAvg >= 7 ? "default" : "destructive"} className="ml-auto">
              {generalAvg.toFixed(1)} / 10
            </Badge>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-4 animate-fade-in-up">
        {/* General Average Banner */}
        {generalAvg !== null && (
          <Card className="shadow-sm bg-gradient-to-br from-primary to-[#2B5F8E] text-primary-foreground">
            <CardContent className="p-5 text-center">
              <p className="text-sm text-white/70">Promedio General Anual</p>
              <p className="text-5xl font-extrabold mt-1">{generalAvg.toFixed(1)}</p>
              <p className="text-xs text-white/50 mt-0.5">/10</p>
              <div className="mt-3 space-x-2">
                <Badge variant={generalAvg >= 7 ? "default" : "destructive"} className={generalAvg >= 7 ? "bg-white/20 text-white" : ""}>
                  {generalAvg >= 7 ? "Aprobado" : "En recuperacion"}
                </Badge>
                <Badge className="bg-white/10 text-white/80">
                  {graded.length} calificaciones
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs: tasks vs summary */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          <button
            onClick={() => setTab("tasks")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "tasks" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Por Tarea ({graded.length + pending.length})
          </button>
          <button
            onClick={() => setTab("summary")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "summary" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Por Trimestre
          </button>
        </div>

        {/* TASKS TAB */}
        {tab === "tasks" && (
          <div className="space-y-3">
            {/* Graded */}
            {graded.length === 0 && pending.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-4 font-medium text-muted-foreground">Aun no tienes calificaciones</p>
                  <p className="text-sm text-muted-foreground/60">Tus notas apareceran aqui cuando el docente califique tus tareas</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {graded.map((row, i) => (
                  <Card key={`g-${i}`} className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span>{row.subjectEmoji}</span>
                            <span className="text-xs text-muted-foreground">{row.subjectName}</span>
                            <Badge variant="secondary" className="text-[9px]">
                              {TRIMESTER_NAMES[row.trimester]}
                            </Badge>
                          </div>
                          <h4 className="text-sm font-bold text-foreground">{row.assignmentTitle}</h4>
                          {row.submittedAt && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Entregado: {new Date(row.submittedAt).toLocaleDateString("es-EC")}
                            </p>
                          )}
                          {row.feedback && (
                            <p className="text-xs text-muted-foreground flex items-start gap-1">
                              <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                              {row.feedback}
                            </p>
                          )}
                        </div>
                        <div className="text-center shrink-0">
                          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold ${
                            (row.grade ?? 0) >= 7
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-red-50 text-red-600 border border-red-200"
                          }`}>
                            {row.grade?.toFixed(1) || "—"}
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-0.5">/10</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Pending (submitted, not graded yet) */}
                {pending.map((row, i) => (
                  <Card key={`p-${i}`} className="shadow-sm opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span>{row.subjectEmoji}</span>
                            <span className="text-xs text-muted-foreground">{row.subjectName}</span>
                            <Badge variant="secondary" className="text-[9px]">
                              {TRIMESTER_NAMES[row.trimester]}
                            </Badge>
                          </div>
                          <h4 className="text-sm font-bold text-foreground">{row.assignmentTitle}</h4>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Entregado - Esperando calificacion
                          </p>
                        </div>
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted border border-dashed">
                          <span className="text-xs text-muted-foreground">—</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        {/* SUMMARY TAB */}
        {tab === "summary" && (
          <div className="space-y-4">
            {/* Formula */}
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm">
              <p className="font-bold text-primary">Formula anual</p>
              <p className="text-muted-foreground text-xs mt-1">(Promedio T1 + Promedio T2 + Promedio T3) / 3 = Nota final</p>
              <p className="text-muted-foreground text-xs">Nota minima para aprobar: <strong>7/10</strong></p>
            </div>

            {summary.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">Sin datos de calificaciones</p>
                </CardContent>
              </Card>
            ) : (
              summary.map((s, i) => (
                <Card key={i} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {s.subjectEmoji} {s.subjectName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">T1</p>
                        <p className="text-lg font-extrabold text-foreground tabular-nums">
                          {s.t1Avg?.toFixed(1) || "—"}
                        </p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">T2</p>
                        <p className="text-lg font-extrabold text-foreground tabular-nums">
                          {s.t2Avg?.toFixed(1) || "—"}
                        </p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">T3</p>
                        <p className="text-lg font-extrabold text-foreground tabular-nums">
                          {s.t3Avg?.toFixed(1) || "—"}
                        </p>
                      </div>
                      <div className="bg-accent rounded-lg p-3">
                        <p className="text-[10px] text-accent-foreground">Anual</p>
                        <p className={`text-lg font-extrabold tabular-nums ${(s.yearlyAvg ?? 0) >= 7 ? "text-emerald-600" : "text-red-600"}`}>
                          {s.yearlyAvg?.toFixed(1) || "—"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">{s.totalGraded} tareas calificadas</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
      <StudentBottomNav />
    </div>
  );
}
