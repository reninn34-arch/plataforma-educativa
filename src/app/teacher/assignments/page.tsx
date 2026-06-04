"use client";

import { CreateAssignmentForm } from "@/components/teacher/CreateAssignmentForm";
import { Pencil } from "lucide-react";

export default function TeacherAssignmentsPage() {
  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md">
            <Pencil size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Gestión de Tareas</h1>
            <p className="text-sm text-slate-400">Crea, edita y asigna tareas a tus estudiantes</p>
          </div>
        </div>
        <CreateAssignmentForm />
      </div>
    </div>
  );
}
