"use client";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, Target, AlertTriangle, Award, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface AnalyticsData {
  overall: { totalSessions: number; totalAnswers: number; avgScore: number; avgCorrect: number } | null;
  bySubject: { subjectId: number; subjectName: string; subjectEmoji: string; totalAnswers: number; correctCount: number; percentage: number }[];
  byStudent: { userId: number; fullName: string; cedula: string; sessions: number; avgScore: number; totalCorrect: number; totalAnswers: number; percentage: number }[];
  errorTopics: { topic: string; subjectName: string; subjectEmoji: string; wrongCount: number }[];
}

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = () => {
    setLoading(true);
    fetch("/api/analytics/overview")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAnalytics(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  // Fallback if no real data yet
  const hasData = data?.overall && data.overall.totalSessions > 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Analiticas de Practica IA</h2>
        <button onClick={fetchAnalytics} className="text-xs text-primary hover:underline">Actualizar</button>
      </div>

      {/* Overall Stats */}
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
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{hasData ? `${data!.overall!.avgCorrect}%` : "—"}</p>
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

      {/* Per Subject */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rendimiento por Materia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(data?.bySubject?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin datos aun. Los estudiantes deben completar ejercicios de practica.</p>
          ) : (
            data!.bySubject.map((s) => (
              <div key={s.subjectId} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{s.subjectEmoji} {s.subjectName}</span>
                  <span className="text-xs font-bold text-muted-foreground tabular-nums">{s.percentage}%</span>
                </div>
                <Progress value={s.percentage} className="h-2" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Error Topics */}
      <Card className="shadow-sm border-amber-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Temas con mas errores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.errorTopics?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin datos suficientes para clasificar errores.</p>
          ) : (
            <div className="space-y-2">
              {data!.errorTopics.slice(0, 8).map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{t.subjectEmoji} {t.subjectName}</Badge>
                    <span className="text-sm text-foreground">{t.topic || "Sin clasificar"}</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">{t.wrongCount} errores</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per Student */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rendimiento por Estudiante</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.byStudent?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin datos de estudiantes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Estudiante</th>
                    <th className="text-center py-2 font-medium">Sesiones</th>
                    <th className="text-center py-2 font-medium">% Aciertos</th>
                    <th className="text-right py-2 font-medium">XP Prom</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.byStudent.map((s) => (
                    <tr key={s.userId} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium text-foreground">{s.fullName}</td>
                      <td className="text-center tabular-nums text-muted-foreground">{s.sessions}</td>
                      <td className="text-center">
                        <span className={`text-xs font-bold ${s.percentage >= 70 ? "text-emerald-600" : s.percentage >= 40 ? "text-amber-600" : "text-destructive"}`}>
                          {s.percentage}%
                        </span>
                      </td>
                      <td className="text-right tabular-nums font-bold text-muted-foreground">{s.avgScore || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
