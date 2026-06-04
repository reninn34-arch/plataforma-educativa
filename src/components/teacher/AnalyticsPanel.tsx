"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, Target, AlertTriangle, Award, Brain } from "lucide-react";


import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface AnalyticsData {
  overall: { totalSessions: number; totalAnswers: number; avgScore: number; avgCorrect: number } | null;
  bySubject: { subjectId: number; subjectName: string; subjectEmoji: string; totalAnswers: number; correctCount: number; percentage: number }[];
  byStudent: { userId: number; fullName: string; cedula: string; sessions: number; avgScore: number; totalCorrect: number; totalAnswers: number; percentage: number }[];
  errorTopics: { topic: string; subjectName: string; subjectEmoji: string; wrongCount: number }[];
}

interface CursoOption {
  id: number;
  nombre: string;
  nivel: string;
}

interface CoursesData { cursos: CursoOption[]; }
interface OverviewData extends AnalyticsData {}

export function AnalyticsPanel({ cursoId: initialCursoId }: { cursoId?: number | null }) {
  const [cursoId, setCursoId] = useState<number | null>(initialCursoId ?? null);

  const { data: coursesData } = useQuery<CoursesData, Error>({
    queryKey: ["teacher-courses"],
    queryFn: async () => { const res = await apiFetch("/api/teacher/courses"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, refetch } = useQuery<OverviewData, Error>({
    queryKey: ["analytics-overview", cursoId],
    queryFn: async () => {
      let url = "/api/analytics/overview";
      if (cursoId) url += `?cursoId=${cursoId}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const cursos = coursesData?.cursos || [];

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
    </div>
  );

  const hasData = data?.overall && data.overall.totalSessions > 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Analiticas de Practica IA</h2>
        <div className="flex items-center gap-3">
          {cursos.length > 1 && (
            <select
              value={cursoId || ""}
              onChange={e => setCursoId(e.target.value ? Number(e.target.value) : null)}
              className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
            >
              <option value="">Todos los cursos</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          )}
          <button onClick={() => refetch()} className="text-xs text-indigo-600 hover:underline">Actualizar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 text-center">
            <Brain className="mx-auto h-5 w-5 text-purple-500 mb-1" />
            <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{hasData ? data!.overall!.totalSessions : 0}</p>
            <p className="text-[11px] text-slate-500">Sesiones</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 text-center">
            <Target className="mx-auto h-5 w-5 text-blue-500 mb-1" />
            <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{hasData ? data!.overall!.totalAnswers : 0}</p>
            <p className="text-[11px] text-slate-500">Respuestas</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-emerald-500 mb-1" />
            <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{hasData ? data!.overall!.avgCorrect : 0}%</p>
            <p className="text-[11px] text-slate-500">% Correcto</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 text-center">
            <Award className="mx-auto h-5 w-5 text-amber-500 mb-1" />
            <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{hasData ? data!.overall!.avgScore : 0}</p>
            <p className="text-[11px] text-slate-500">XP Promedio</p>
          </div>
        </div>
      </div>

      {data?.bySubject && data.bySubject.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100"><h3 className="text-base font-bold text-slate-800">Rendimiento por Materia</h3></div>
          <div className="p-5 space-y-3">
            {data.bySubject.map(s => (
              <div key={s.subjectId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{s.subjectEmoji} {s.subjectName}</span>
                  <span className="text-sm font-bold tabular-nums">{s.percentage}%</span>
                </div>
                <Progress value={s.percentage} className="h-2" />
                <p className="text-[10px] text-slate-500 mt-0.5">{s.correctCount}/{s.totalAnswers} correctas</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.errorTopics && data.errorTopics.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Top 8 Temas con Errores
            </h3>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              {data.errorTopics.slice(0, 8).map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-slate-100/20 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] shrink-0 rounded-lg border-slate-200">{t.subjectEmoji}</Badge>
                    <span className="text-xs truncate">{t.topic || "General"}</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px] shrink-0 ml-2 rounded-lg">{t.wrongCount} errores</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data?.byStudent && data.byStudent.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100"><h3 className="text-base font-bold text-slate-800">Desempeño por Estudiante</h3></div>
          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="text-left py-2 font-medium">Estudiante</th>
                    <th className="text-center py-2 font-medium">Sesiones</th>
                    <th className="text-center py-2 font-medium">% Aciertos</th>
                    <th className="text-center py-2 font-medium">XP Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStudent.map(s => (
                    <tr key={s.userId} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium text-slate-800 text-xs flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">
                          {s.fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        {s.fullName}
                      </td>
                      <td className="text-center text-xs">{s.sessions}</td>
                      <td className="text-center">
                        <Badge variant={s.percentage >= 70 ? "default" : s.percentage >= 40 ? "outline" : "destructive"} className="text-[10px] rounded-lg">{s.percentage}%</Badge>
                      </td>
                      <td className="text-center text-xs font-bold tabular-nums">{s.avgScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
