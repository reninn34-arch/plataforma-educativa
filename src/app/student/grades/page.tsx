"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, TrendingUp, BarChart3, Clock, AlertCircle, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentBottomNav } from "@/components/StudentBottomNav";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

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

interface GradesData {
  graded: GradeRow[];
  pending: GradeRow[];
  notSubmittedCount: number;
  summary: SubjectSummary[];
  generalAvg: number | null;
}

const TRIMESTER_NAMES: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };

function GradeBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300">—</span>;
  const isGood = value >= 7;
  return (
    <span className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl text-xl font-extrabold border-2 ${
      isGood
        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
        : "bg-red-50 text-red-600 border-red-200"
    }`}>
      {value.toFixed(1)}
    </span>
  );
}

export default function StudentGradesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"tasks" | "summary">("tasks");

  const { data, isLoading } = useQuery<GradesData, Error>({
    queryKey: ["student-grades"],
    queryFn: async () => {
      const res = await apiFetch("/api/student/grades");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
  });

  const graded = data?.graded || [];
  const pending = data?.pending || [];
  const summary = data?.summary || [];
  const generalAvg = data?.generalAvg ?? null;

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando calificaciones...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/student/dashboard")}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Award size={22} className="text-amber-500" />
              Mis Calificaciones
            </h1>
            <p className="text-sm text-slate-400">Notas oficiales enviadas por tus docentes</p>
          </div>
        </div>

        {/* General Average Hero */}
        {generalAvg !== null && (
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-sm font-medium">Promedio General Anual</p>
                <p className="text-5xl font-extrabold mt-1">{generalAvg.toFixed(1)}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                    generalAvg >= 7 ? "bg-emerald-400/20 text-emerald-200" : "bg-red-400/20 text-red-200"
                  }`}>
                    {generalAvg >= 7 ? <Star size={12} /> : <AlertCircle size={12} />}
                    {generalAvg >= 7 ? "Aprobado" : "En recuperación"}
                  </span>
                  <span className="text-indigo-200 text-xs">
                    {graded.length} calificaciones
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex items-center justify-center w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="text-center">
                  <p className="text-3xl font-extrabold">{generalAvg.toFixed(0)}</p>
                  <p className="text-[10px] text-indigo-200">/10</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl">
          <button
            onClick={() => setTab("tasks")}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
              tab === "tasks" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Por Tarea ({graded.length + pending.length})
          </button>
          <button
            onClick={() => setTab("summary")}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
              tab === "summary" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Por Trimestre
          </button>
        </div>

        {/* Tasks View */}
        {tab === "tasks" && (
          <div className="space-y-3">
            {graded.length === 0 && pending.length === 0 ? (
              <Card className="shadow-sm border-slate-200">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 size={32} className="text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-600">Aún no tienes calificaciones</p>
                  <p className="text-sm text-slate-400 mt-1">Tus notas aparecerán cuando el docente califique tus tareas</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {graded.map((row, i) => (
                  <div key={`g-${i}`} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{row.subjectEmoji}</span>
                          <span className="text-xs font-medium text-slate-500">{row.subjectName}</span>
                          <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600">{TRIMESTER_NAMES[row.trimester]}</Badge>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">{row.assignmentTitle}</h4>
                        {row.submittedAt && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock size={12} />
                            Entregado: {new Date(row.submittedAt).toLocaleDateString("es-EC")}
                          </p>
                        )}
                        {row.feedback && (
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-xs text-slate-500 flex items-start gap-1.5">
                              <MessageSquare size={12} className="mt-0.5 shrink-0 text-indigo-400" />
                              {row.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="text-center shrink-0">
                        <GradeBadge value={row.grade} />
                        <p className="text-[9px] text-slate-400 mt-0.5">/10</p>
                      </div>
                    </div>
                  </div>
                ))}
                {pending.map((row, i) => (
                  <div key={`p-${i}`} className="bg-white rounded-2xl border border-slate-200 p-5 opacity-70">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{row.subjectEmoji}</span>
                          <span className="text-xs font-medium text-slate-500">{row.subjectName}</span>
                          <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600">{TRIMESTER_NAMES[row.trimester]}</Badge>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">{row.assignmentTitle}</h4>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <AlertCircle size={12} />
                          Entregado — Esperando calificación
                        </p>
                      </div>
                      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200">
                        <span className="text-xs text-slate-400 font-bold">—</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Summary View */}
        {tab === "summary" && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <TrendingUp size={20} className="text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-indigo-800 text-sm">Fórmula anual</p>
                  <p className="text-xs text-indigo-600 mt-0.5">(Promedio T1 + Promedio T2 + Promedio T3) / 3 = Nota final</p>
                  <p className="text-xs text-indigo-500 mt-1">Nota mínima para aprobar: <strong>7/10</strong></p>
                </div>
              </div>
            </div>
            {summary.length === 0 ? (
              <Card className="shadow-sm border-slate-200">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 size={32} className="text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-600">Sin datos de calificaciones</p>
                </CardContent>
              </Card>
            ) : (
              summary.map((s, i) => {
                const theme = subjectTheme(s.subjectName.toLowerCase());
                return (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">{s.subjectEmoji}</span>
                      <h3 className={`font-bold text-sm ${theme.text}`}>{s.subjectName}</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className={`${theme.bgLight} rounded-xl p-3 text-center border ${theme.border}`}>
                        <p className="text-[10px] text-slate-500 font-medium">T1</p>
                        <p className={`text-lg font-extrabold ${s.t1Avg !== null && s.t1Avg >= 7 ? "text-emerald-600" : s.t1Avg !== null ? "text-red-600" : "text-slate-300"}`}>
                          {s.t1Avg?.toFixed(1) || "—"}
                        </p>
                      </div>
                      <div className={`${theme.bgLight} rounded-xl p-3 text-center border ${theme.border}`}>
                        <p className="text-[10px] text-slate-500 font-medium">T2</p>
                        <p className={`text-lg font-extrabold ${s.t2Avg !== null && s.t2Avg >= 7 ? "text-emerald-600" : s.t2Avg !== null ? "text-red-600" : "text-slate-300"}`}>
                          {s.t2Avg?.toFixed(1) || "—"}
                        </p>
                      </div>
                      <div className={`${theme.bgLight} rounded-xl p-3 text-center border ${theme.border}`}>
                        <p className="text-[10px] text-slate-500 font-medium">T3</p>
                        <p className={`text-lg font-extrabold ${s.t3Avg !== null && s.t3Avg >= 7 ? "text-emerald-600" : s.t3Avg !== null ? "text-red-600" : "text-slate-300"}`}>
                          {s.t3Avg?.toFixed(1) || "—"}
                        </p>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-3 text-center border border-indigo-100">
                        <p className="text-[10px] text-indigo-500 font-medium">Anual</p>
                        <p className={`text-lg font-extrabold ${(s.yearlyAvg ?? 0) >= 7 ? "text-emerald-600" : "text-red-600"}`}>
                          {s.yearlyAvg?.toFixed(1) || "—"}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-3">{s.totalGraded} tareas calificadas</p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      <StudentBottomNav />
    </div>
  );
}
