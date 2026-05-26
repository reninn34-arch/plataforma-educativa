"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, TrendingUp, Target, Award, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  subjects: SubjectGrade[];
}

function GradeStat({ value, isYearly }: { value: number | null; isYearly?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground/50">—</span>;
  const color = value >= 7 ? "text-emerald-600" : value >= 5 ? "text-amber-600" : "text-red-600";
  return (
    <span className={`text-xs font-bold tabular-nums ${color} ${isYearly ? "text-sm bg-muted px-2 py-1 rounded" : ""}`}>
      {value.toFixed(2)}
    </span>
  );
}

export function GradebookPanel() {
  const [gradebook, setGradebook] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [trimesterFilter, setTrimesterFilter] = useState(0);

  const fetchGradebook = () => {
    setLoading(true);
    fetch(`/api/analytics/gradebook?trimester=${trimesterFilter}`)
      .then(r => r.json())
      .then(d => { setGradebook(d.gradebook || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchGradebook(); }, [trimesterFilter]);

  // Calculate class averages
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

  if (loading) return (
    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Libro de Calificaciones</h2>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(t => (
            <Badge
              key={t}
              variant={trimesterFilter === t ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setTrimesterFilter(t)}
            >
              {t === 0 ? "Anual" : `T${t}`}
            </Badge>
          ))}
        </div>
      </div>

      {/* Formula card */}
      <Card className="shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4 text-sm">
          <p className="font-bold text-primary">Formula de calculo anual</p>
          <p className="text-muted-foreground mt-1">
            <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">(Promedio Trimestre 1 + Promedio Trimestre 2 + Promedio Trimestre 3) / 3</code>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Si un trimestre no tiene notas, se considera 0. Nota minima para aprobar: 7/10.
          </p>
        </CardContent>
      </Card>

      {/* Class Overview */}
      {classStats.generalAverage !== null && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="shadow-sm col-span-2 sm:col-span-1">
            <CardContent className="p-4 text-center">
              <Award className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="text-2xl font-extrabold text-foreground tabular-nums">{classStats.generalAverage.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">Promedio General</p>
            </CardContent>
          </Card>
          {classStats.bySubject.map(s => (
            <Card key={s.id} className="shadow-sm">
              <CardContent className="p-4 text-center">
                <span className="text-lg">{s.emoji}</span>
                <p className="text-lg font-extrabold text-foreground tabular-nums mt-0.5">
                  {s.yearlyAvg?.toFixed(2) || "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">{s.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Per Subject Breakdown */}
      {classStats.bySubject.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Promedios por Trimestre</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Materia</th>
                    <th className="text-center py-2 font-medium">T1</th>
                    <th className="text-center py-2 font-medium">T2</th>
                    <th className="text-center py-2 font-medium">T3</th>
                    <th className="text-center py-2 font-medium bg-muted/50 rounded">Anual</th>
                  </tr>
                </thead>
                <tbody>
                  {classStats.bySubject.map(s => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium text-foreground">{s.emoji} {s.name}</td>
                      <td className="text-center"><GradeStat value={s.t1Avg} /></td>
                      <td className="text-center"><GradeStat value={s.t2Avg} /></td>
                      <td className="text-center"><GradeStat value={s.t3Avg} /></td>
                      <td className="text-center bg-muted/30"><GradeStat value={s.yearlyAvg} isYearly /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Gradebook Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Calificaciones por Estudiante
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gradebook.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin calificaciones registradas. Crea tareas y califica entregas para ver datos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium sticky left-0 bg-card">Estudiante</th>
                    {gradebook[0]?.subjects.map(s => (
                      <th key={s.subjectId} className="text-center py-2 font-medium">{s.subjectEmoji}</th>
                    ))}
                    <th className="text-center py-2 font-medium bg-muted/30 rounded">Prom. Anual</th>
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
                      <tr key={student.studentId} className={`border-b border-border/50 last:border-0 ${si % 2 === 0 ? "bg-muted/20" : ""}`}>
                        <td className="py-2.5 sticky left-0 bg-card">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                              {student.studentName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <span className="font-medium text-foreground text-xs">{student.studentName}</span>
                          </div>
                        </td>
                        {student.subjects.map(subj => (
                          <td key={subj.subjectId} className="text-center">
                            <div className="flex flex-col items-center">
                              <GradeStat value={subj.yearlyAvg} isYearly />
                              {subj.totalGrades > 0 && (
                                <span className="text-[9px] text-muted-foreground">{subj.totalGrades} notas</span>
                              )}
                            </div>
                          </td>
                        ))}
                        <td className="text-center bg-muted/20">
                          <span className={`text-sm font-extrabold ${studentYearlyAvg !== null && studentYearlyAvg >= 7 ? "text-emerald-600" : studentYearlyAvg !== null && studentYearlyAvg >= 5 ? "text-amber-600" : studentYearlyAvg !== null ? "text-red-600" : "text-muted-foreground"}`}>
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
        </CardContent>
      </Card>
    </div>
  );
}
