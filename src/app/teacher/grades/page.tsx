"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GradebookPanel } from "@/components/teacher/GradebookPanel";
import { Download, ClipboardCheck } from "lucide-react";

function GradesContent() {
  const searchParams = useSearchParams();
  const cursoId = searchParams.get("cursoId") ? parseInt(searchParams.get("cursoId")!) : null;

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Libro de Calificaciones</h1>
              <p className="text-sm text-slate-400">Revisa y exporta el consolidado de notas por materia</p>
            </div>
          </div>
          <a
            href={cursoId ? `/api/analytics/export?cursoId=${cursoId}` : "/api/analytics/export"}
            download
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Download size={16} />
            Exportar CSV
          </a>
        </div>
        <GradebookPanel cursoId={cursoId} />
      </div>
    </div>
  );
}

export default function TeacherGradesPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Cargando calificaciones...</p>
        </div>
      </div>
    }>
      <GradesContent />
    </Suspense>
  );
}
