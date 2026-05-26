"use client";

import { CreateAssignmentForm } from "@/components/teacher/CreateAssignmentForm";

export default function TeacherAssignmentsPage() {
  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div className="border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestión de Tareas</h1>
        <p className="text-sm text-muted-foreground mt-1">Crea, edita y asigna tareas a tus estudiantes.</p>
      </div>
      <CreateAssignmentForm />
    </div>
  );
}
