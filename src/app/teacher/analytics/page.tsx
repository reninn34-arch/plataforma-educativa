"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnalyticsPanel } from "@/components/teacher/AnalyticsPanel";
import { BarChart3 } from "lucide-react";

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const cursoId = searchParams.get("cursoId") ? parseInt(searchParams.get("cursoId")!) : null;

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Analíticas con IA</h1>
              <p className="text-sm text-slate-400">Métricas de riesgo predictivo y desempeño estudiantil</p>
            </div>
          </div>
        </div>
        <AnalyticsPanel cursoId={cursoId} />
      </div>
    </div>
  );
}

export default function TeacherAnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Cargando analíticas...</p>
        </div>
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
