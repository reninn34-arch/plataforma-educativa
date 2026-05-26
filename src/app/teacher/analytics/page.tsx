"use client";

import { AnalyticsPanel } from "@/components/teacher/AnalyticsPanel";

export default function TeacherAnalyticsPage() {
  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analíticas con IA</h1>
          <p className="text-sm text-muted-foreground mt-1">Métricas de riesgo predictivo y desempeño estudiantil.</p>
        </div>
      </div>
      <AnalyticsPanel />
    </div>
  );
}
