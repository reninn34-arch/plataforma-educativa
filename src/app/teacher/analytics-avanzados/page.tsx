"use client";

import { useState, useMemo, useCallback } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  BarChart3, TrendingUp, AlertTriangle, Download, Users, Award,
  RefreshCw, ChevronDown, AlertCircle, BookOpen, ArrowUpDown,
} from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";
import { Badge } from "@/components/ui/badge";

interface StudentPerformance {
  id: number;
  fullName: string;
  promedio: number;
  totalAssignments: number;
  submittedAssignments: number;
  pendientes: number;
  riesgo: "bajo" | "medio" | "alto";
}

interface PeriodComparison {
  trimester: number;
  label: string;
  students: { name: string; promedio: number }[];
}

interface TeacherPerformanceData {
  profile: { id: number; fullName: string; cedula: string; role: string; email?: string } | null;
  students: StudentPerformance[];
  periodComparison: PeriodComparison[];
  stats: { enRiesgo: number; promedioGeneral: number; estudiantesConDatos: number };
  activePeriod: { id: number; nombre: string } | null;
  periods: { id: number; nombre: string; activo: boolean }[];
}

interface CursoOption { id: number; nombre: string; nivel: string; }
interface CoursesData { cursos: CursoOption[]; }

const RISK_COLORS = { bajo: "#22c55e", medio: "#f59e0b", alto: "#ef4444" };

function exportToCsv(students: StudentPerformance[]) {
  const header = ["Nombre", "Promedio", "Tareas", "Entregadas", "Pendientes", "Riesgo"];
  const rows = students.map(s => [
    s.fullName,
    s.promedio.toString(),
    s.totalAssignments.toString(),
    s.submittedAssignments.toString(),
    s.pendientes.toString(),
    s.riesgo,
  ]);
  const csv = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-docente-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RiskBadge({ riesgo }: { riesgo: string }) {
  const map: Record<string, { label: string; variant: "destructive" | "outline" | "default" }> = {
    bajo: { label: "Bajo", variant: "default" },
    medio: { label: "Medio", variant: "outline" },
    alto: { label: "Alto", variant: "destructive" },
  };
  const m = map[riesgo] || { label: riesgo, variant: "outline" as const };
  return <Badge variant={m.variant} className="text-xs rounded-lg">{m.label}</Badge>;
}

function AnalyticsAvanzadosContent() {
  const searchParams = useSearchParams();
  const filterCursoId = searchParams.get("cursoId") ? parseInt(searchParams.get("cursoId")!) : null;

  const [cursoId, setCursoId] = useState<number | null>(filterCursoId);
  const [periodoId, setPeriodoId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"promedio" | "nombre">("promedio");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: coursesData } = useQuery<CoursesData, Error>({
    queryKey: ["teacher-courses"],
    queryFn: async () => {
      const res = await apiFetch("/api/teacher/courses");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const queryParams = new URLSearchParams();
  if (cursoId) queryParams.set("cursoId", String(cursoId));
  if (periodoId) queryParams.set("periodoId", String(periodoId));

  const { data, isLoading, refetch } = useQuery<TeacherPerformanceData, Error>({
    queryKey: ["teacher-performance", cursoId, periodoId],
    queryFn: async () => {
      const url = `/api/analytics/teacher-performance?${queryParams.toString()}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const toggleSort = (field: "promedio" | "nombre") => {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir(field === "promedio" ? "asc" : "asc");
    }
  };

  const sortedStudents = useMemo(() => {
    if (!data?.students) return [];
    return [...data.students].sort((a, b) => {
      if (sortBy === "promedio") {
        return sortDir === "asc" ? a.promedio - b.promedio : b.promedio - a.promedio;
      }
      return sortDir === "asc"
        ? a.fullName.localeCompare(b.fullName)
        : b.fullName.localeCompare(a.fullName);
    });
  }, [data?.students, sortBy, sortDir]);

  const chartData = useMemo(() => {
    return sortedStudents.map(s => ({
      name: s.fullName.split(" ").slice(0, 2).join(" "),
      promedio: s.promedio,
      riesgo: s.riesgo,
      fullName: s.fullName,
    }));
  }, [sortedStudents]);

  const atRiskStudents = useMemo(() => {
    return (data?.students || []).filter(s => s.riesgo === "alto");
  }, [data?.students]);

  const hasData = data && data.students.length > 0;
  const cursos = coursesData?.cursos || [];
  const periods = data?.periods || [];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Cargando analytics avanzados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full min-w-0 animate-fade-in-up overflow-x-hidden">
      <div className="w-full max-w-6xl mx-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-20 lg:pb-8 space-y-6">
        <div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shrink-0">
              <TrendingUp size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Analytics Avanzados</h1>
              <p className="text-xs sm:text-sm text-slate-400">Rendimiento académico, detección de riesgo y comparativa por período</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {cursos.length > 1 && (
              <div className="relative">
                <select
                  value={cursoId || ""}
                  onChange={e => setCursoId(e.target.value ? Number(e.target.value) : null)}
                  className="h-8 appearance-none rounded-xl border border-border bg-card pl-3 pr-7 text-xs focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none w-[160px] truncate"
                >
                  <option value="">Todos los cursos</option>
                  {cursos.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              </div>
            )}
            {periods.length > 1 && (
              <div className="relative">
                <select
                  value={periodoId || ""}
                  onChange={e => setPeriodoId(e.target.value ? Number(e.target.value) : null)}
                  className="h-8 appearance-none rounded-xl border border-border bg-card pl-3 pr-7 text-xs focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none w-[160px] truncate"
                >
                  <option value="">Período activo</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                onClick={() => exportToCsv(data!.students)}
                className="h-8 px-3 rounded-xl border border-border text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Download className="h-3 w-3" />
                Exportar CSV
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="h-8 px-3 rounded-xl border border-border text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="h-3 w-3" />
              Actualizar
            </button>
          </div>
        </div>

        {hasData ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 p-4 min-h-[100px]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{data!.students.length}</p>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Estudiantes</p>
              </div>
              <div className="bg-card rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 p-4 min-h-[100px]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{data!.stats.promedioGeneral}</p>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Promedio Gral.</p>
              </div>
              <div className="bg-card rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 p-4 min-h-[100px]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{data!.stats.estudiantesConDatos}</p>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Con datos</p>
              </div>
              <div className="bg-card rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 p-4 min-h-[100px]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-sm">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{data!.stats.enRiesgo}</p>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">En riesgo</p>
              </div>
            </div>

            {atRiskStudents.length > 0 && (
              <div className="bg-card rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-red-100 bg-red-50/50">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-bold text-red-700">Estudiantes en riesgo ({atRiskStudents.length})</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {atRiskStudents.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-600">
                          {s.fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{s.fullName}</p>
                          <p className="text-[10px] text-slate-400">
                            {s.submittedAssignments}/{s.totalAssignments} tareas · {s.pendientes} pendientes
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-red-500 tabular-nums">{s.promedio}</p>
                        <RiskBadge riesgo={s.riesgo} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-foreground">Rendimiento por estudiante</h3>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <button
                    onClick={() => toggleSort("promedio")}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${sortBy === "promedio" ? "bg-indigo-50 text-indigo-600 font-semibold" : "hover:bg-muted"}`}
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    Promedio
                  </button>
                  <button
                    onClick={() => toggleSort("nombre")}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${sortBy === "nombre" ? "bg-indigo-50 text-indigo-600 font-semibold" : "hover:bg-muted"}`}
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    Nombre
                  </button>
                </div>
              </div>
              {chartData.length > 0 ? (
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32 + 40)}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#475569" }}
                        width={80}
                      />
                      <Tooltip
                        formatter={(value) => [value, "Promedio"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      />
                      <Bar dataKey="promedio" radius={[0, 6, 6, 0]}>
                        {chartData.map((entry, index) => {
                          const color = entry.riesgo === "alto" ? "#ef4444" : entry.riesgo === "medio" ? "#f59e0b" : "#22c55e";
                          return <Cell key={index} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">Sin datos de rendimiento</p>
              )}
            </div>

            {data?.periodComparison && data.periodComparison.length > 1 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.periodComparison.map(pc => (
                  <div key={pc.trimester} className="bg-card rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <h3 className="text-sm font-bold text-foreground">{pc.label}</h3>
                    </div>
                    {pc.students.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {pc.students.slice(0, 8).map((s, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2">
                            <span className="text-xs text-foreground truncate max-w-[120px]">{s.name}</span>
                            <span className="text-xs font-bold tabular-nums">{Math.round(s.promedio * 10) / 10}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-6">Sin datos</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-card rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <Users className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-foreground">Listado completo de estudiantes</h3>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 font-medium">Estudiante</th>
                      <th className="text-center py-2 font-medium">Promedio</th>
                      <th className="text-center py-2 font-medium">Tareas</th>
                      <th className="text-center py-2 font-medium">Entregadas</th>
                      <th className="text-center py-2 font-medium">Pendientes</th>
                      <th className="text-center py-2 font-medium">Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map(s => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 text-xs font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                              {s.fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <span className="truncate max-w-[140px]">{s.fullName}</span>
                          </div>
                        </td>
                        <td className="text-center text-xs font-bold tabular-nums">
                          <span className={s.promedio < 7 ? "text-red-500" : s.promedio < 8.5 ? "text-amber-500" : "text-green-500"}>
                            {s.promedio || "—"}
                          </span>
                        </td>
                        <td className="text-center text-xs">{s.totalAssignments}</td>
                        <td className="text-center text-xs">{s.submittedAssignments}</td>
                        <td className="text-center text-xs">{s.pendientes}</td>
                        <td className="text-center"><RiskBadge riesgo={s.riesgo} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-card rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
            <BarChart3 className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-400">No hay datos de rendimiento disponibles</p>
            <p className="text-xs text-slate-300 mt-1">Crea tareas y califica a tus estudiantes para ver analytics</p>
          </div>
        )}

        <div className="h-4 lg:hidden" />
      </div>
    </div>
  );
}

export default function TeacherAnalyticsAvanzadosPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Cargando analytics...</p>
        </div>
      </div>
    }>
      <AnalyticsAvanzadosContent />
    </Suspense>
  );
}
