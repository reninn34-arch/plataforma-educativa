"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, BookOpen, ChevronRight, GraduationCap, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

interface Cuestionario {
  id: number;
  title: string;
  description: string;
  subjectName: string;
  subjectEmoji: string;
  subjectSlug: string;
  cursoNombre: string;
  createdAt: string;
  preguntaCount: number;
}

export default function StudentCuestionariosPage() {
  const { data, isLoading } = useQuery<{ cuestionarios: Cuestionario[] }>({
    queryKey: ["student-cuestionarios"],
    queryFn: async () => {
      const res = await apiFetch("/api/student/cuestionarios");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const cuestionarios = data?.cuestionarios || [];

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
          <Link
            href="/student/dashboard"
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Cuestionarios de Estudio</h1>
            <p className="text-sm text-slate-400">{cuestionarios.length} cuestionarios disponibles</p>
          </div>
        </div>

        {cuestionarios.length > 0 ? (
          <div className="bg-card rounded-2xl border border-border divide-y divide-slate-100 overflow-hidden shadow-sm">
            {cuestionarios.map((c) => {
              const theme = subjectTheme(c.subjectSlug);
              return (
                <Link
                  key={c.id}
                  href={`/student/cuestionarios/${c.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
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
                        <span className="flex items-center gap-1">
                          <GraduationCap size={12} />
                          {c.preguntaCount} preguntas
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="shadow-sm border-border">
            <CardContent className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <BookOpen size={32} className="text-slate-300" />
              </div>
              <p className="font-semibold text-muted-foreground">No hay cuestionarios disponibles</p>
              <p className="text-sm text-slate-400">Tus docentes aun no han publicado cuestionarios de estudio</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
