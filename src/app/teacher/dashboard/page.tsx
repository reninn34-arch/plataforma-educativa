"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StudentsTable } from "@/components/teacher/StudentsTable";
import { Download, BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface CursoOption {
  id: number;
  nombre: string;
  nivel: string;
  mySubjects: { subjectEmoji: string; subjectName: string }[];
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cursoId = searchParams.get("cursoId") ? parseInt(searchParams.get("cursoId")!) : null;
  const [cursos, setCursos] = useState<CursoOption[]>([]);
  const [selectedCurso, setSelectedCurso] = useState<CursoOption | null>(null);
  const [activePeriod, setActivePeriod] = useState<{ nombre: string } | null>(null);

  useEffect(() => {
    fetch("/api/teacher/courses")
      .then(r => r.json())
      .then(d => {
        setCursos(d.cursos || []);
        if (cursoId) {
          const found = (d.cursos || []).find((c: CursoOption) => c.id === cursoId);
          if (found) setSelectedCurso(found);
        }
      })
      .catch(() => {});

    fetch("/api/teacher/periodos")
      .then(r => r.json())
      .then(d => {
        if (d.active) setActivePeriod(d.active);
      })
      .catch(() => {});
  }, [cursoId]);

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            {selectedCurso ? (
              <>
                <Button variant="ghost" size="icon-sm" onClick={() => router.push("/teacher/dashboard")} title="Ver todos los cursos">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {selectedCurso.nombre}
                </h1>
                <span className="text-sm text-muted-foreground">{selectedCurso.nivel}</span>
                {selectedCurso.mySubjects.length > 0 && (
                  <div className="flex gap-1">
                    {selectedCurso.mySubjects.map((s, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {s.subjectEmoji} {s.subjectName}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Panel Principal</h1>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedCurso
              ? `Estudiantes y progreso del curso ${selectedCurso.nombre}`
              : "Monitorea el progreso y riesgo de todos tus estudiantes"}
            {activePeriod && (
              <span className="ml-3 inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                📅 {activePeriod.nombre}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {cursos.length > 1 && (
            <select
              value={cursoId || ""}
              onChange={e => {
                if (e.target.value) {
                  router.push(`/teacher/dashboard?cursoId=${e.target.value}`);
                } else {
                  router.push("/teacher/dashboard");
                }
              }}
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="">Todos los cursos</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.nivel})</option>
              ))}
            </select>
          )}
          <a href="/api/analytics/export" download className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
            <Download className="h-4 w-4" />
            Exportar Datos
          </a>
        </div>
      </div>

      {!cursoId && cursos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
          <span className="text-sm text-muted-foreground">Selecciona un curso para filtrar:</span>
          {cursos.map(c => (
            <button
              key={c.id}
              onClick={() => router.push(`/teacher/dashboard?cursoId=${c.id}`)}
              className="text-sm font-medium text-primary hover:underline"
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      <StudentsTable cursoId={cursoId} />
    </div>
  );
}

export default function TeacherDashboard() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
