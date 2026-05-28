"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GradebookPanel } from "@/components/teacher/GradebookPanel";
import { Download } from "lucide-react";

function GradesContent() {
  const searchParams = useSearchParams();
  const cursoId = searchParams.get("cursoId") ? parseInt(searchParams.get("cursoId")!) : null;

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Libro de Calificaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">Revisa y exporta el consolidado de notas por materia.</p>
        </div>
        <a
          href={cursoId ? `/api/analytics/export?cursoId=${cursoId}` : "/api/analytics/export"}
          download
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </a>
      </div>
      <GradebookPanel cursoId={cursoId} />
    </div>
  );
}

export default function TeacherGradesPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <GradesContent />
    </Suspense>
  );
}
