"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnalyticsPanel } from "@/components/teacher/AnalyticsPanel";

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const cursoId = searchParams.get("cursoId") ? parseInt(searchParams.get("cursoId")!) : null;

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analiticas con IA</h1>
          <p className="text-sm text-muted-foreground mt-1">Metricas de riesgo predictivo y desempeno estudiantil.</p>
        </div>
      </div>
      <AnalyticsPanel cursoId={cursoId} />
    </div>
  );
}

export default function TeacherAnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
