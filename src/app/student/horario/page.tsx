"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Clock, Coffee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

interface Bloque {
  id: number;
  dia: string;
  horaInicio: string;
  horaFin: string;
  subjectId: number | null;
  subjectName: string | null;
  subjectEmoji: string | null;
  tipo: string;
}

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"];
const DIAS_LABEL: Record<string, string> = {
  lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves", viernes: "Viernes",
};

export default function StudentHorarioPage() {
  const { data, isLoading } = useQuery<{ horarios: Bloque[] }, Error>({
    queryKey: ["student-horario"],
    queryFn: async () => {
      const res = await apiFetch("/api/student/horario");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const horarios = data?.horarios || [];
  const bloquesPorDia = (dia: string) => horarios.filter(h => h.dia === dia && (h.subjectId || h.tipo === "receso"));

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando horario...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/student/dashboard"
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Mi Horario</h1>
            <p className="text-sm text-slate-400">Plan de clases semanal</p>
          </div>
        </div>

        {horarios.length === 0 ? (
          <Card className="shadow-sm border-border">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-slate-300" />
              </div>
              <p className="font-semibold text-muted-foreground">Horario no disponible</p>
              <p className="text-sm text-slate-400 mt-1">El administrador aún no ha configurado el horario.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {DIAS.map(dia => {
              const bloques = bloquesPorDia(dia);
              const horas = [...new Set(bloques.map(b => `${b.horaInicio}-${b.horaFin}`))];
              return (
                <div key={dia} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3">
                    <h3 className="font-bold text-white text-sm">{DIAS_LABEL[dia]}</h3>
                    <p className="text-indigo-200 text-[11px]">{bloques.length} bloques</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {horas.map(bloque => {
                      const [inicio, fin] = bloque.split("-");
                      const b = bloques.find(h => `${h.horaInicio}-${h.horaFin}` === bloque);
                      if (!b) return null;

                      const theme = b.subjectName ? subjectTheme(b.subjectName.toLowerCase()) : null;

                      if (b.tipo === "receso") {
                        return (
                          <div key={bloque} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <div className="flex items-center gap-2">
                              <Coffee size={16} className="text-amber-500" />
                              <span className="text-xs font-semibold text-amber-700">Receso</span>
                            </div>
                            <p className="text-[10px] text-amber-500 mt-1">{inicio} - {fin}</p>
                          </div>
                        );
                      }

                      return (
                        <div key={bloque} className={`rounded-xl p-3 border ${theme?.border || "border-border"} ${theme?.bgLight || "bg-muted"}`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-lg">{b.subjectEmoji || "📚"}</span>
                            <span className={`text-xs font-bold ${theme?.text || "text-foreground"}`}>
                              {b.subjectName || "Materia"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400 font-medium">{inicio} - {fin}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
