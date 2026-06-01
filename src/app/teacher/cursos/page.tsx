"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Users as UsersIcon, BookOpen } from "lucide-react";
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

interface CursoInfo {
  id: number;
  nombre: string;
  nivel: string;
  profesorId: number | null;
  profesorNombre: string | null;
  studentCount: number;
  isTutor: boolean;
  teacherSubjects: { teacherId: number; teacherName: string; subjectId: number; subjectName: string; subjectEmoji: string }[];
  mySubjects: { teacherId: number; teacherName: string; subjectId: number; subjectName: string; subjectEmoji: string }[];
}

interface CoursesData { cursos: CursoInfo[]; }
interface HorarioData { horarios: Bloque[]; }

export default function TeacherCursosPage() {
  const router = useRouter();

  const { data: coursesData, isLoading: coursesLoading } = useQuery<CoursesData, Error>({
    queryKey: ["teacher-courses"],
    queryFn: async () => {
      const res = await apiFetch("/api/teacher/courses");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: horarioData, isLoading: horarioLoading } = useQuery<HorarioData, Error>({
    queryKey: ["teacher-horario"],
    queryFn: async () => {
      const res = await apiFetch("/api/teacher/horario");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = coursesLoading || horarioLoading;
  const cursos = coursesData?.cursos || [];
  const horarios = horarioData?.horarios || [];

  const schedule: Record<number, Bloque[]> = {};
  for (const h of horarios) {
    if (!schedule[h.cursoId]) schedule[h.cursoId] = [];
    schedule[h.cursoId].push(h);
  }

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mis Cursos</h1>
        <p className="text-sm text-muted-foreground mt-1">{cursos.length} {cursos.length === 1 ? "curso asignado" : "cursos asignados"}</p>
      </div>

      {cursos.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center space-y-3">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No tienes cursos asignados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {cursos.map(c => (
            <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-foreground">{c.nombre}</h3>
                      <p className="text-sm text-muted-foreground">{c.nivel}</p>
                    </div>
                    <div className="flex gap-1">
                      {c.isTutor && <Badge variant="secondary" className="text-[10px]">Tutor</Badge>}
                      <Badge variant="secondary" className="text-[10px] flex items-center gap-1"><UsersIcon className="h-3 w-3" /> {c.studentCount}</Badge>
                    </div>
                  </div>
                </div>

                {schedule[c.id] && schedule[c.id].length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">🕐 Tu horario</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr>
                            {["lun","mar","mie","jue","vie"].map(d => (
                              <th key={d} className="p-1 border bg-muted/30 text-center font-semibold capitalize">{d}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {["lunes","martes","miercoles","jueves","viernes"].map(dia => {
                              const bloques = schedule[c.id].filter((h: any) => h.dia === dia);
                              return (
                                <td key={dia} className="p-1 border align-top">
                                  {bloques.length === 0 ? <span className="text-muted-foreground/40">—</span> : (
                                    <div className="space-y-0.5">
                                      {bloques.map((b: any, i: number) => (
                                        <div key={i} className="text-center leading-tight">
                                          <span>{b.subjectEmoji}</span>
                                          <div className="text-[8px] text-muted-foreground">{b.horaInicio}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {c.mySubjects.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tus materias en este curso</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.mySubjects.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs gap-1 py-1"><span>{s.subjectEmoji}</span> {s.subjectName}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {c.teacherSubjects.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Todos los profesores</p>
                    <div className="flex flex-wrap gap-1">
                      {c.teacherSubjects.map((ts, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] py-0.5 gap-1">
                          <span>{ts.subjectEmoji}</span><span>{ts.subjectName}</span><span className="text-muted-foreground">· {ts.teacherName}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="gap-2" onClick={() => router.push(`/teacher/dashboard?cursoId=${c.id}`)}>
                    Ver estudiantes <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}