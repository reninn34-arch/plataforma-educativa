"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, ChevronRight, GraduationCap, Loader2, Trash2, Eye, Plus, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";
import { useState } from "react";

interface Cuestionario {
  id: number;
  title: string;
  description: string;
  subjectName: string;
  subjectEmoji: string;
  subjectSlug: string;
  cursoNombre: string;
  cursoNivel: string;
  createdAt: string;
  preguntaCount: number;
}

export default function TeacherCuestionariosPage() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ cuestionarios: Cuestionario[] }>({
    queryKey: ["teacher-cuestionarios"],
    queryFn: async () => {
      const res = await apiFetch("/api/teacher/cuestionarios");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const cuestionarios = data?.cuestionarios || [];

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este cuestionario de estudio? Los estudiantes ya no podrán acceder a él.")) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/teacher/cuestionarios/${id}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["teacher-cuestionarios"] });
      }
    } catch {}
    setDeletingId(null);
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando cuestionarios...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
            <GraduationCap size={20} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Cuestionarios de Estudio</h1>
            <p className="text-sm text-slate-400">
              {cuestionarios.length > 0
                ? `${cuestionarios.length} cuestionario${cuestionarios.length === 1 ? "" : "s"} creado${cuestionarios.length === 1 ? "" : "s"}`
                : "Crea cuestionarios con el asistente IA para que tus estudiantes estudien"}
            </p>
          </div>
          <Link href="/teacher/cuestionarios/nuevo">
            <Button className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200">
              <Plus className="h-4 w-4" /> Nuevo Cuestionario
            </Button>
          </Link>
        </div>

        {cuestionarios.length > 0 ? (
          <div className="bg-card rounded-2xl border border-border divide-y divide-slate-100 overflow-hidden shadow-sm">
            {cuestionarios.map((c) => {
              const theme = subjectTheme(c.subjectSlug);
              return (
                <div key={c.id} className="flex items-center justify-between p-4 hover:bg-muted transition-colors group">
                  <Link href={`/teacher/cuestionarios/${c.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl ${theme.bgLight} flex items-center justify-center text-lg shrink-0`}>
                      {c.subjectEmoji || "📚"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-indigo-600 transition-colors">
                        {c.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.subjectName}{c.cursoNombre ? ` · ${c.cursoNombre}` : ""}
                      </p>
                      <div className="flex gap-3 mt-1.5 text-[10px] text-slate-400">
                        <span>{c.preguntaCount} preguntas</span>
                        <span>{new Date(c.createdAt).toLocaleDateString("es-EC")}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Link
                      href={`/teacher/cuestionarios/${c.id}`}
                      className="p-2 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Ver cuestionario"
                    >
                      <Eye size={16} />
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      {deletingId === c.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="shadow-sm border-border">
            <CardContent className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <GraduationCap size={32} className="text-slate-300" />
              </div>
              <p className="font-semibold text-muted-foreground">No hay cuestionarios de estudio</p>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Crea un cuestionario manualmente o usa el asistente IA en el chat:
              </p>
              <p className="text-xs text-slate-400">
                Los estudiantes verán los cuestionarios en su menú {'>'} Estudio
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
