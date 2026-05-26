"use client";

import { GradebookPanel } from "@/components/teacher/GradebookPanel";

export default function TeacherGradesPage() {
  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Libro de Calificaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">Revisa y exporta el consolidado de notas por materia.</p>
        </div>
      </div>
      <GradebookPanel />
    </div>
  );
}
