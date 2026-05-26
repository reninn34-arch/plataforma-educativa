"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Award, BookOpen, Flame, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SUBJECTS } from "@/lib/utils";

// Mini formal progress bar
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
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [streakDays, setStreakDays] = useState(5);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    setUserName("Estudiante");
    const stored = typeof window !== "undefined" ? localStorage.getItem("atlas-progress") : null;
    if (stored) {
      setProgress(JSON.parse(stored));
    } else {
      const defaults: Record<string, number> = {};
      SUBJECTS.forEach((s) => { defaults[s.id] = Math.floor(Math.random() * 60); });
      setProgress(defaults);
    }
    setStreakDays(Math.floor(Math.random() * 7) + 3);

    fetch("/api/assignments?role=student")
      .then(r => r.json())
      .then(d => { if (d.assignments) setAssignments(d.assignments); })
      .catch(() => {});

    fetch("/api/student/metrics")
      .then(r => r.json())
      .then(d => setMetrics(d))
      .catch(() => {});
  }, []);

  const totalProgress = Math.round(SUBJECTS.reduce((acc, s) => acc + (progress[s.id] ?? 0), 0) / SUBJECTS.length) || 0;

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Visión General</h1>
          <p className="text-sm text-muted-foreground mt-1">Bienvenido de vuelta, {userName}. Aquí tienes un resumen de tu actividad académica.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Promedio</span>
              <Award className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{totalProgress}%</div>
            <div className="mt-3">
              <ProgressBar percentage={totalProgress} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Materias</span>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground mt-1">Activas este periodo</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Asistencia</span>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{streakDays} días</div>
            <p className="text-xs text-muted-foreground mt-1">Racha consecutiva</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tiempo</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">12.5h</div>
            <p className="text-xs text-muted-foreground mt-1">Dedicación mensual</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Main Content: Subjects List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Estado de Materias</h2>
            <Link href="/student/grades" className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">Ver historial completo →</Link>
          </div>
          
          <div className="grid gap-3">
            {SUBJECTS.map((subject) => {
              const pct = progress[subject.id] ?? 0;
              const isHigh = pct >= 70;
              const isMedium = pct >= 40;
              return (
                <Link
                  key={subject.id}
                  href={`/student/learn/${subject.id}`}
                  className="flex items-center justify-between p-4 bg-card border rounded-lg hover:border-muted-foreground/30 transition-colors group shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted/30 text-lg">
                      {subject.emoji}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-foreground">{subject.name}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        {isHigh ? (
                          <Badge variant="outline" className="text-[10px] font-normal text-emerald-700 bg-emerald-50 border-emerald-200">Aprobando</Badge>
                        ) : isMedium ? (
                          <Badge variant="outline" className="text-[10px] font-normal text-blue-700 bg-blue-50 border-blue-200">En curso</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-normal text-amber-700 bg-amber-50 border-amber-200">Atención requerida</Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">{pct}% completado</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidebar widgets */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">Tareas Pendientes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {assignments.length > 0 ? (
                <div className="divide-y">
                  {assignments.slice(0, 4).map((a) => (
                    <Link
                      key={a.id}
                      href={`/student/assignments/${a.id}`}
                      className="flex flex-col p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{a.subjectName}</p>
                        </div>
                        {a.status === "submitted" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <div className="h-2 w-2 mt-1.5 rounded-full bg-amber-500" />
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No hay tareas pendientes.
                </div>
              )}
            </CardContent>
          </Card>
          
          {metrics && metrics.totalSessions > 0 && (
             <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold">Métricas de IA</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Sesiones prácticas</span>
                  <span className="font-medium tabular-nums">{metrics.totalSessions}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Precisión general</span>
                  <span className="font-medium tabular-nums">{metrics.accuracy}%</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
