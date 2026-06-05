"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, TrendingUp, Target, AlertTriangle,
  Award, Brain, RefreshCw, ChevronDown
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface AnalyticsData {
  overall: { totalSessions: number; totalAnswers: number; avgScore: number; avgCorrect: number } | null;
  bySubject: { subjectId: number; subjectName: string; subjectEmoji: string; totalAnswers: number; correctCount: number; percentage: number }[];
  byStudent: { userId: number; fullName: string; cedula: string; sessions: number; avgScore: number; totalCorrect: number; totalAnswers: number; percentage: number }[];
  errorTopics: { topic: string; subjectName: string; subjectEmoji: string; wrongCount: number }[];
}

interface CursoOption { id: number; nombre: string; nivel: string; }
interface CoursesData { cursos: CursoOption[]; }
interface OverviewData extends AnalyticsData {}

/* ─── Stat card ─────────────────────────────────────── */
function StatCard({
  icon, value, label, bgFrom, bgTo,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  bgFrom: string;
  bgTo: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 p-4 min-h-[100px]">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bgFrom} ${bgTo} flex items-center justify-center shadow-sm`}>
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-slate-800 tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}

/* ─── Section wrapper ────────────────────────────────── */
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        {icon && <span className="shrink-0">{icon}</span>}
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────── */
export function AnalyticsPanel({ cursoId: initialCursoId }: { cursoId?: number | null }) {
  const [cursoId, setCursoId] = useState<number | null>(initialCursoId ?? null);

  const { data: coursesData } = useQuery<CoursesData, Error>({
    queryKey: ["teacher-courses"],
    queryFn: async () => {
      const res = await apiFetch("/api/teacher/courses");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, refetch } = useQuery<OverviewData, Error>({
    queryKey: ["analytics-overview", cursoId],
    queryFn: async () => {
      const url = cursoId
        ? `/api/analytics/overview?cursoId=${cursoId}`
        : "/api/analytics/overview";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const cursos = coursesData?.cursos || [];
  const hasData = data?.overall && data.overall.totalSessions > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    /* Full-width, no side overflow */
    <div className="w-full min-w-0 space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-700">Analíticas de Práctica IA</p>
        <div className="flex items-center gap-2">
          {cursos.length > 1 && (
            <div className="relative">
              <select
                value={cursoId || ""}
                onChange={e => setCursoId(e.target.value ? Number(e.target.value) : null)}
                className="h-8 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-7 text-xs focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none w-[150px] truncate"
              >
                <option value="">Todos los cursos</option>
                {cursos.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="h-8 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
            Actualizar
          </button>
        </div>
      </div>

      {/* ── KPI cards: always 2 columns on mobile, 4 on ≥sm ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Brain className="h-5 w-5 text-white" />}
          value={hasData ? data!.overall!.totalSessions : 0}
          label="Sesiones"
          bgFrom="from-violet-500"
          bgTo="to-purple-600"
        />
        <StatCard
          icon={<Target className="h-5 w-5 text-white" />}
          value={hasData ? data!.overall!.totalAnswers : 0}
          label="Respuestas"
          bgFrom="from-blue-500"
          bgTo="to-cyan-500"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-white" />}
          value={hasData ? `${data!.overall!.avgCorrect}%` : "0%"}
          label="% Correcto"
          bgFrom="from-emerald-400"
          bgTo="to-teal-500"
        />
        <StatCard
          icon={<Award className="h-5 w-5 text-white" />}
          value={hasData ? data!.overall!.avgScore : 0}
          label="XP Prom."
          bgFrom="from-amber-400"
          bgTo="to-orange-500"
        />
      </div>

      {/* ── Rendimiento por Materia ── */}
      {data?.bySubject && data.bySubject.length > 0 && (
        <Section title="Rendimiento por Materia">
          <div className="p-4 space-y-4">
            {data.bySubject.map(s => (
              <div key={s.subjectId} className="w-full min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-700 truncate flex-1 min-w-0">
                    {s.subjectEmoji} {s.subjectName}
                  </span>
                  <span className="text-xs font-bold text-slate-800 tabular-nums shrink-0">
                    {s.percentage}%
                  </span>
                </div>
                <Progress value={s.percentage} className="h-2 w-full" />
                <p className="text-[10px] text-slate-400 mt-1">
                  {s.correctCount}/{s.totalAnswers} correctas
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Top Temas con Errores ── */}
      {data?.errorTopics && data.errorTopics.length > 0 && (
        <Section
          title="Temas con más Errores"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        >
          <div className="p-3 space-y-2">
            {data.errorTopics.slice(0, 8).map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5"
              >
                {/* rank */}
                <span className="text-[10px] font-bold text-slate-300 w-4 shrink-0">
                  #{i + 1}
                </span>
                {/* emoji */}
                <span className="text-sm shrink-0">{t.subjectEmoji}</span>
                {/* topic name */}
                <span className="flex-1 text-xs text-slate-700 truncate min-w-0">
                  {t.topic || "General"}
                </span>
                {/* count */}
                <Badge
                  variant="destructive"
                  className="text-[10px] rounded-lg px-2 py-0.5 shrink-0 whitespace-nowrap"
                >
                  {t.wrongCount}✗
                </Badge>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Desempeño por Estudiante ── */}
      {data?.byStudent && data.byStudent.length > 0 && (
        <Section title="Desempeño por Estudiante">
          {/* Mobile: vertical card list */}
          <div className="sm:hidden divide-y divide-slate-100">
            {data.byStudent.map(s => {
              const initials = s.fullName
                .split(" ")
                .map(n => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <div key={s.userId} className="flex items-center gap-3 px-4 py-3">
                  {/* avatar */}
                  <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                    {initials}
                  </div>
                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{s.fullName}</p>
                    <p className="text-[10px] text-slate-400">
                      {s.sessions} ses. · {s.avgScore} XP
                    </p>
                  </div>
                  {/* badge */}
                  <Badge
                    variant={s.percentage >= 70 ? "default" : s.percentage >= 40 ? "outline" : "destructive"}
                    className="text-xs rounded-xl shrink-0"
                  >
                    {s.percentage}%
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto p-4">
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
                {data.byStudent.map(s => {
                  const initials = s.fullName
                    .split(" ")
                    .map(n => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <tr key={s.userId} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 text-xs font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                            {initials}
                          </div>
                          <span className="truncate max-w-[140px]">{s.fullName}</span>
                        </div>
                      </td>
                      <td className="text-center text-xs">{s.sessions}</td>
                      <td className="text-center">
                        <Badge
                          variant={s.percentage >= 70 ? "default" : s.percentage >= 40 ? "outline" : "destructive"}
                          className="text-xs rounded-lg"
                        >
                          {s.percentage}%
                        </Badge>
                      </td>
                      <td className="text-center text-xs font-bold tabular-nums">{s.avgScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Spacer for floating bottom nav ── */}
      <div className="h-4 lg:hidden" />
    </div>
  );
}
