"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

interface CursoTab {
  id: number;
  nombre: string;
  mySubjects: { subjectEmoji: string; subjectName: string }[];
}

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"];

const SUBJECT_COLORS: Record<string, string> = {
  "Matematicas": "bg-blue-50 border-blue-200 text-blue-800",
  "Fisica": "bg-emerald-50 border-emerald-200 text-emerald-800",
  "Ingles": "bg-purple-50 border-purple-200 text-purple-800",
  "Quimica": "bg-amber-50 border-amber-200 text-amber-800",
};

function getColor(name: string | null): string {
  if (!name) return "bg-slate-50 border-slate-200 text-slate-600";
  return SUBJECT_COLORS[name] || "bg-slate-50 border-slate-200 text-slate-600";
}

function getTimeBlocks(horarios: Bloque[]) {
  return [...new Set(horarios.map(h => `${h.horaInicio}-${h.horaFin}`))]
    .map(b => {
      const [hi, hf] = b.split("-");
      return { horaInicio: hi, horaFin: hf };
    })
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

function ScheduleTable({ horarios, timeBlocks }: { horarios: Bloque[], timeBlocks: { horaInicio: string; horaFin: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border shadow-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-3 border-b bg-muted/50 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
              Hora
            </th>
            {DIAS.map(dia => (
              <th key={dia} className="p-3 border-b bg-muted/50 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">
                {dia.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeBlocks.map((tb, tIdx) => (
            <tr key={`${tb.horaInicio}-${tb.horaFin}`} className={tIdx % 2 === 0 ? "bg-card" : "bg-muted/10"}>
              <td className="p-2 border-r text-xs text-muted-foreground text-center font-mono">
                <span className="font-semibold">{tb.horaInicio}</span>
                <br />
                <span className="text-[10px]">{tb.horaFin}</span>
              </td>
              {DIAS.map(dia => {
                const b = horarios.find(
                  h => h.dia === dia && h.horaInicio === tb.horaInicio && h.horaFin === tb.horaFin
                );
                if (!b) return <td key={dia} className="p-1 border-r" />;

                if (b.tipo === "receso") {
                  return (
                    <td key={dia} className="p-1 border-r">
                      <div className="flex items-center justify-center h-full min-h-[55px]">
                        <Badge variant="secondary" className="text-[10px] gap-1">☕ Receso</Badge>
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={dia} className="p-1 border-r">
                    <div className={`flex flex-col items-center justify-center rounded-lg p-2 min-h-[60px] border ${getColor(b.subjectName)}`}>
                      <span className="text-xl">{b.subjectEmoji || "📚"}</span>
                      <span className="text-[11px] font-semibold mt-0.5 text-center leading-tight">{b.subjectName || "—"}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TeacherHorarioPage() {
  const [horarios, setHorarios] = useState<Bloque[]>([]);
  const [cursos, setCursos] = useState<CursoTab[]>([]);
  const [activeTab, setActiveTab] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/courses")
      .then(r => r.json())
      .then(d => {
        setCursos(d.cursos || []);
      })
      .catch(() => {});

    fetch("/api/teacher/horario")
      .then(r => r.json())
      .then(d => {
        setHorarios(d.horarios || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredHorarios = activeTab === "all"
    ? horarios
    : horarios.filter(h => h.cursoId === activeTab);

  const timeBlocks = getTimeBlocks(filteredHorarios);
  const currentCurso = typeof activeTab === "number" ? cursos.find(c => c.id === activeTab) : null;

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      <div className="border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mi Horario</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {currentCurso
            ? `${currentCurso.nombre} · ${currentCurso.mySubjects.length} materia${currentCurso.mySubjects.length > 1 ? "s" : ""}`
            : "Clases que impartes durante la semana"}
        </p>
      </div>

      {horarios.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 font-medium text-muted-foreground">No tienes horario asignado</p>
            <p className="text-sm text-muted-foreground mt-1">El administrador aun no ha configurado los horarios.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-muted/50 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === "all" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              Todos los cursos
            </button>
            {cursos.filter(c => horarios.some(h => h.cursoId === c.id)).map(c => (
              <button
                key={c.id}
                onClick={() => setActiveTab(c.id)}
                className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === c.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                <Users className="h-4 w-4" />
                {c.nombre}
              </button>
            ))}
          </div>

          {/* Current tab info */}
          {currentCurso && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Tus materias:</span>
              {currentCurso.mySubjects.map((s, i) => (
                <Badge key={i} variant="outline" className="text-[10px] gap-1">
                  <span>{s.subjectEmoji}</span> {s.subjectName}
                </Badge>
              ))}
            </div>
          )}

          {/* Schedule table */}
          {filteredHorarios.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Este curso no tiene bloques con tus materias.</p>
              </CardContent>
            </Card>
          ) : (
            <ScheduleTable horarios={filteredHorarios} timeBlocks={timeBlocks} />
          )}

          {/* Mobile cards per day */}
          <div className="lg:hidden space-y-4">
            {DIAS.map(dia => {
              const bloques = filteredHorarios.filter(h =>
                h.dia === dia && (h.subjectId !== null || h.tipo === "receso")
              );
              if (bloques.length === 0) return null;
              return (
                <Card key={dia} className="shadow-sm">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-bold text-foreground capitalize mb-3">{dia}</h3>
                    <div className="space-y-2">
                      {bloques.map((b, i) => (
                        <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${getColor(b.subjectName)}`}>
                          <span className="text-xs font-mono text-muted-foreground w-20">
                            {b.horaInicio} - {b.horaFin}
                          </span>
                          {b.tipo === "receso" ? (
                            <Badge variant="secondary" className="text-[10px]">☕ Receso</Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{b.subjectEmoji}</span>
                              <p className="text-xs font-semibold">{b.subjectName}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
