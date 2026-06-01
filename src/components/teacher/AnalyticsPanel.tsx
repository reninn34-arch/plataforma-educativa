"use client";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, Target, AlertTriangle, Award, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function AnalyticsPanel({ cursoId: initialCursoId }: { cursoId?: number | null }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursoId, setCursoId] = useState<number | null>(initialCursoId ?? null);
  const [cursos, setCursos] = useState<CursoOption[]>([]);

  const fetchAnalytics = () => {
    setLoading(true);
    let url = "/api/analytics/overview";
    if (cursoId) url += `?cursoId=${cursoId}`;
    apiFetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    apiFetch("/api/teacher/courses").then(r => r.json()).then(d => setCursos(d.cursos || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchAnalytics(); }, [cursoId]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const hasData = data?.overall && data.overall.totalSessions > 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Analiticas de Practica IA</h2>
        <div className="flex items-center gap-3">
          {cursos.length > 1 && (
            <select
              value={cursoId || ""}
              onChange={e => setCursoId(e.target.value ? Number(e.target.value) : null)}
              className="h-8 rounded-lg border border-input bg-card px-3 text-xs"
            >
              <option value="">Todos los cursos</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          )}
          <button onClick={fetchAnalytics} className="text-xs text-primary hover:underline">Actualizar</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <Brain className="mx-auto h-5 w-5 text-purple-500 mb-1" />
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{hasData ? data!.overall!.totalSessions : 0}</p>
            <p className="text-[11px] text-muted-foreground">Sesiones</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <Target className="mx-auto h-5 w-5 text-blue-500 mb-1" />
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{hasData ? data!.overall!.totalAnswers : 0}</p>
            <p className="text-[11px] text-muted-foreground">Respuestas</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-emerald-500 mb-1" />
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{hasData ? data!.overall!.avgCorrect : 0}%</p>
            <p className="text-[11px] text-muted-foreground">% Correcto</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <Award className="mx-auto h-5 w-5 text-amber-500 mb-1" />
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{hasData ? data!.overall!.avgScore : 0}</p>
            <p className="text-[11px] text-muted-foreground">XP Promedio</p>
          </CardContent>
        </Card>
      </div>

      {data?.bySubject && data.bySubject.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Rendimiento por Materia</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.bySubject.map(s => (
              <div key={s.subjectId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{s.subjectEmoji} {s.subjectName}</span>
                  <span className="text-sm font-bold tabular-nums">{s.percentage}%</span>
                </div>
                <Progress value={s.percentage} className="h-2" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.correctCount}/{s.totalAnswers} correctas</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data?.errorTopics && data.errorTopics.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Top 8 Temas con Errores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.errorTopics.slice(0, 8).map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] shrink-0">{t.subjectEmoji}</Badge>
                    <span className="text-xs truncate">{t.topic || "General"}</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px] shrink-0 ml-2">{t.wrongCount} errores</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data?.byStudent && data.byStudent.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Desempeño por Estudiante</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Estudiante</th>
                    <th className="text-center py-2 font-medium">Sesiones</th>
                    <th className="text-center py-2 font-medium">% Aciertos</th>
                    <th className="text-center py-2 font-medium">XP Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStudent.map(s => (
                    <tr key={s.userId} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium text-foreground text-xs flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                          {s.fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        {s.fullName}
                      </td>
                      <td className="text-center text-xs">{s.sessions}</td>
                      <td className="text-center">
                        <Badge variant={s.percentage >= 70 ? "default" : s.percentage >= 40 ? "outline" : "destructive"} className="text-[10px]">{s.percentage}%</Badge>
                      </td>
                      <td className="text-center text-xs font-bold tabular-nums">{s.avgScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
