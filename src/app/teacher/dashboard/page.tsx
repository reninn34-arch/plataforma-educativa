"use client";

import { StudentsTable } from "@/components/teacher/StudentsTable";
import { Download } from "lucide-react";

export default function TeacherDashboard() {
  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Listado de Estudiantes</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitorea el progreso, semáforo de riesgo y actividad reciente de todos tus estudiantes.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/api/analytics/export" download className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors">
            <Download className="h-4 w-4" />
            Exportar Datos
          </a>
        </div>
      </div>
      
      <StudentsTable />
    </div>
  );
}
