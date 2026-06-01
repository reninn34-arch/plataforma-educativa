"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";

interface Bloque {
  id: number;
  dia: string;
  horaInicio: string;
  horaFin: string;
  subjectId: number | null;
  subjectName: string | null;
  subjectEmoji: string | null;
  tipo: string;
  cursoId: number;
}

interface HorarioData { horarios: Bloque[]; }
interface CoursesData { cursos: { id: number; nombre: string; nivel: string; mySubjects: { subjectEmoji: string; subjectName: string }[] }[]; }

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"];
const SUBJECT_COLORS: Record<string, string> = { matematicas: "bg-blue-100 text-blue-700", fisica: "bg-purple-100 text-purple-700", Quimica: "bg-green-100 text-green-700", biologia: "bg-red-100 text-red-700", historia: "bg-yellow-100 text-yellow-700", literatura: "bg-pink-100 text-pink-700", filosofia: "bg-indigo-100 text-indigo-700", arte: "bg-orange-100 text-orange-700", educacion_civica: "bg-teal-100 text-teal-700", ingles: "bg-cyan-100 text-cyan-700" };
const DIAS_LABEL: Record<string, string> = { lunes: "Lun", martes: "Mar", miercoles: "Mie", jueves: "Jue", viernes: "Vie" };

export default function TeacherHorarioPage() {
  const { data: horarioData, isLoading: horarioLoading } = useQuery<HorarioData, Error>({
    queryKey: ["teacher-horario"],
    queryFn: async () => {
      const res = await apiFetch("/api/teacher/horario");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery<CoursesData, Error>({
    queryKey: ["teacher-courses"],
    queryFn: async () => {
      const res = await apiFetch("/api/teacher/courses");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = horarioLoading || coursesLoading;
  const horarios = horarioData?.horarios || [];
  const cursos = coursesData?.cursos || [];
  const [selectedCurso, setSelectedCurso] = useState<string>("todos");
  const [showRecesos, setShowRecesos] = useState(true);

  const filtered = selectedCurso === "todos" ? horarios : horarios.filter(h => h.cursoId.toString() === selectedCurso);
  const bloquesPorDia = (dia: string) => filtered.filter(h => h.dia === dia && (showRecesos || h.tipo !== "receso"));

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Horario</h1>
          <p className="text-sm text-muted-foreground mt-1">Horario semanal por curso</p>
        </div>
        <div className="flex items-center gap-3">
          {cursos.length > 1 && (
            <select value={selectedCurso} onChange={e => setSelectedCurso(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-3 text-sm">
              <option value="todos">Todos los cursos</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.nivel})</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showRecesos} onChange={e => setShowRecesos(e.target.checked)} className="rounded" />
            Mostrar recreos
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="shadow-sm"><CardContent className="py-16 text-center"><Clock className="mx-auto h-10 w-10 text-muted-foreground/30" /><p className="mt-4 font-medium text-muted-foreground">Sin horario disponible</p></CardContent></Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-2 border bg-muted/50 text-left text-xs font-semibold text-muted-foreground">Hora</th>
                {DIAS.map(dia => <th key={dia} className="p-2 border bg-muted/50 text-center text-xs font-semibold text-muted-foreground">{DIAS_LABEL[dia]}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...new Set(filtered.map(h => `${h.horaInicio}-${h.horaFin}`))].map(bloque => {
                const [inicio, fin] = bloque.split("-");
                return (
                  <tr key={bloque}>
                    <td className="p-2 border text-xs text-muted-foreground whitespace-nowrap font-medium">{inicio}<br/>{fin}</td>
                    {DIAS.map(dia => {
                      const b = filtered.find(h => h.dia === dia && `${h.horaInicio}-${h.horaFin}` === bloque);
                      if (!b) return <td key={dia} className="p-2 border"></td>;
                      if (b.tipo === "receso") return <td key={dia} className="p-2 border text-center"><Badge variant="secondary" className="text-[10px]">☕ Receso</Badge></td>;
                      const colorClass = b.subjectName ? (SUBJECT_COLORS[b.subjectName.toLowerCase().replace(/ /g, "_")] || "bg-muted") : "bg-muted";
                      return (
                        <td key={dia} className="p-2 border text-center">
                          <div className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg ${colorClass}`}>
                            <span className="text-lg">{b.subjectEmoji}</span>
                            <span className="text-[10px] font-medium">{b.subjectName}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}