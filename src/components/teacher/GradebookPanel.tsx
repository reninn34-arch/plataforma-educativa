"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, Target, Award, BarChart3 } from "lucide-react";


import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface SubjectGrade {
  subjectId: number;
  subjectName: string;
  subjectEmoji: string;
  t1Avg: number | null;
  t2Avg: number | null;
  t3Avg: number | null;
  yearlyAvg: number | null;
  totalGrades: number;
  overallAvg: number | null;
}

interface StudentGrade {
  studentId: number;
  studentName: string;
  studentCedula: string;
  studentCursoNombre?: string;
  subjects: SubjectGrade[];
}

interface CursoOption {
  id: number;
  nombre: string;
  nivel: string;
}

function GradeStat({ value, isYearly }: { value: number | null; isYearly?: boolean }) {
  if (value === null) return <span className="text-xs text-slate-500/50">—</span>;
  const color = value >= 7 ? "text-emerald-600" : value >= 5 ? "text-amber-600" : "text-red-600";
  return (
    <span className={`text-xs font-bold tabular-nums ${color} ${isYearly ? "text-sm bg-slate-100 px-2 py-1 rounded" : ""}`}>
      {value.toFixed(2)}
    </span>
  );
}

interface CoursesData { cursos: CursoOption[]; }
interface GradebookData { gradebook: StudentGrade[]; }

export function GradebookPanel({ cursoId: initialCursoId }: { cursoId?: number | null }) {
  const [trimesterFilter, setTrimesterFilter] = useState(0);
  const [cursoId, setCursoId] = useState<number | null>(initialCursoId ?? null);

  const { data: coursesData } = useQuery<CoursesData, Error>({
    queryKey: ["teacher-courses"],
    queryFn: async () => { const res = await apiFetch("/api/teacher/courses"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: gradebookData, isLoading } = useQuery<GradebookData, Error>({
    queryKey: ["analytics-gradebook", trimesterFilter, cursoId],
    queryFn: async () => {
      let url = `/api/analytics/gradebook?trimester=${trimesterFilter}`;
      if (cursoId) url += `&cursoId=${cursoId}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const cursos = coursesData?.cursos || [];
  const gradebook = gradebookData?.gradebook || [];

  const classStats = useMemo(() => {
    const allSubjects = new Map<number, { name: string; emoji: string; yearlyAvgs: number[]; t1Avgs: number[]; t2Avgs: number[]; t3Avgs: number[] }>();
    let totalYearlySum = 0;
    let totalYearlyCount = 0;

    gradebook.forEach(s => {
      s.subjects.forEach(subj => {
        if (!allSubjects.has(subj.subjectId)) {
          allSubjects.set(subj.subjectId, { name: subj.subjectName, emoji: subj.subjectEmoji, yearlyAvgs: [], t1Avgs: [], t2Avgs: [], t3Avgs: [] });
        }
        const agg = allSubjects.get(subj.subjectId)!;
        if (subj.yearlyAvg !== null) { agg.yearlyAvgs.push(subj.yearlyAvg); totalYearlySum += subj.yearlyAvg; totalYearlyCount++; }
        if (subj.t1Avg !== null) agg.t1Avgs.push(subj.t1Avg);
        if (subj.t2Avg !== null) agg.t2Avgs.push(subj.t2Avg);
        if (subj.t3Avg !== null) agg.t3Avgs.push(subj.t3Avg);
      });
    });

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    return {
      bySubject: Array.from(allSubjects.entries()).map(([id, agg]) => ({
        id, name: agg.name, emoji: agg.emoji,
        t1Avg: avg(agg.t1Avgs), t2Avg: avg(agg.t2Avgs), t3Avg: avg(agg.t3Avgs),
        yearlyAvg: avg(agg.yearlyAvgs),
      })),
      generalAverage: totalYearlyCount > 0 ? totalYearlySum / totalYearlyCount : null,
    };
  }, [gradebook]);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-slate-800">Libro de Calificaciones</h2>
        <div className="flex gap-2">
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
          {[0, 1, 2, 3].map(t => (
            <Badge
              key={t}
              variant={trimesterFilter === t ? "default" : "outline"}
              className="cursor-pointer rounded-lg"
              onClick={() => setTrimesterFilter(t)}
            >
              {t === 0 ? "Anual" : `T${t}`}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="p-4 text-sm">
          <p className="font-bold text-indigo-600">Formula de calculo anual</p>
          <p className="text-slate-500 mt-1">
            <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">(Promedio Trimestre 1 + Promedio Trimestre 2 + Promedio Trimestre 3) / 3</code>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Si un trimestre no tiene notas, se considera 0. Nota minima para aprobar: 7/10.
          </p>
        </div>
      </div>

      {classStats.generalAverage !== null && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
            <div className="p-5 text-center">
              <Award className="mx-auto h-5 w-5 text-indigo-600 mb-1" />
              <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{classStats.generalAverage.toFixed(2)}</p>
              <p className="text-[11px] text-slate-500">Promedio General</p>
            </div>
          </div>
          {classStats.bySubject.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-5 text-center">
                <span className="text-lg">{s.emoji}</span>
                <p className="text-lg font-extrabold text-slate-800 tabular-nums mt-0.5">
                  {s.yearlyAvg?.toFixed(2) || "—"}
                </p>
                <p className="text-[10px] text-slate-500">{s.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {classStats.bySubject.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-100"><h3 className="text-base font-bold text-slate-800">Promedios por Trimestre</h3></div>
          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="text-left py-2 font-medium">Materia</th>
                    <th className="text-center py-2 font-medium">T1</th>
                    <th className="text-center py-2 font-medium">T2</th>
                    <th className="text-center py-2 font-medium">T3</th>
                    <th className="text-center py-2 font-medium bg-slate-100/50 rounded">Anual</th>
                  </tr>
                </thead>
                <tbody>
                  {classStats.bySubject.map(s => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium text-slate-800">{s.emoji} {s.name}</td>
                      <td className="text-center"><GradeStat value={s.t1Avg} /></td>
                      <td className="text-center"><GradeStat value={s.t2Avg} /></td>
                      <td className="text-center"><GradeStat value={s.t3Avg} /></td>
                      <td className="text-center bg-slate-100/30"><GradeStat value={s.yearlyAvg} isYearly /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Calificaciones por Estudiante
          </h3>
        </div>
        <div className="p-5">
          {gradebook.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Sin calificaciones registradas. Crea tareas y califica entregas para ver datos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="text-left py-2 font-medium sticky left-0 bg-white">Estudiante</th>
                    {!cursoId && <th className="text-left py-2 font-medium">Curso</th>}
                    {gradebook[0]?.subjects.map(s => (
                      <th key={s.subjectId} className="text-center py-2 font-medium">{s.subjectEmoji}</th>
                    ))}
                    <th className="text-center py-2 font-medium bg-slate-100/30 rounded">Prom. Anual</th>
                  </tr>
                </thead>
                <tbody>
                  {gradebook.map((student, si) => {
                    const studentYearlyAvg = (() => {
                      const avgs = student.subjects
                        .map(s => s.yearlyAvg)
                        .filter(v => v !== null) as number[];
                      return avgs.length > 0
                        ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100
                        : null;
                    })();

                    return (
                      <tr key={student.studentId} className={`border-b border-border/50 last:border-0 ${si % 2 === 0 ? "bg-slate-100/20" : ""}`}>
                        <td className="py-2.5 sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">
                              {student.studentName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-800 text-xs">{student.studentName}</span>
                          </div>
                        </td>
                        {!cursoId && (
                          <td className="py-2.5"><Badge variant="outline" className="text-[10px] rounded-lg border-slate-200">{student.studentCursoNombre || "—"}</Badge></td>
                        )}
                        {student.subjects.map(subj => (
                          <td key={subj.subjectId} className="text-center">
                            <div className="flex flex-col items-center">
                              <GradeStat value={subj.yearlyAvg} isYearly />
                              {subj.totalGrades > 0 && (
                                <span className="text-[9px] text-slate-500">{subj.totalGrades} notas</span>
                              )}
                            </div>
                          </td>
                        ))}
                        <td className="text-center bg-slate-100/20">
                          <span className={`text-sm font-extrabold ${studentYearlyAvg !== null && studentYearlyAvg >= 7 ? "text-emerald-600" : studentYearlyAvg !== null && studentYearlyAvg >= 5 ? "text-amber-600" : studentYearlyAvg !== null ? "text-red-600" : "text-slate-500"}`}>
                            {studentYearlyAvg?.toFixed(2) || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
