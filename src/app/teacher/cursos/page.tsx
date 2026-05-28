"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Users as UsersIcon, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export default function TeacherCursosPage() {
  const router = useRouter();
  const [cursos, setCursos] = useState<CursoInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/courses")
      .then(r => r.json())
      .then(d => {
        setCursos(d.cursos || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mis Cursos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {cursos.length} {cursos.length === 1 ? "curso asignado" : "cursos asignados"}
        </p>
      </div>

      {cursos.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center space-y-3">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No tienes cursos asignados</p>
            <p className="text-sm text-muted-foreground">Contacta al administrador para que te asigne a un curso.</p>
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
                      {c.isTutor && (
                        <Badge variant="secondary" className="text-[10px]">Tutor</Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                        <UsersIcon className="h-3 w-3" /> {c.studentCount}
                      </Badge>
                    </div>
                  </div>
                </div>

                {c.mySubjects.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Tus materias en este curso
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.mySubjects.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs gap-1 py-1">
                          <span>{s.subjectEmoji}</span> {s.subjectName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {c.teacherSubjects.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Todos los profesores
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {c.teacherSubjects.map((ts, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] py-0.5 gap-1">
                          <span>{ts.subjectEmoji}</span>
                          <span>{ts.subjectName}</span>
                          <span className="text-muted-foreground">· {ts.teacherName}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => router.push(`/teacher/dashboard?cursoId=${c.id}`)}
                  >
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
