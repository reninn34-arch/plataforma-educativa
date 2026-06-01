"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/fetch-utils";

interface GradeData {
  cursoId?: number; studentId: number; studentName: string; studentCedula: string;
  cursoNombre: string; subjectName: string; subjectEmoji: string;
  assignmentTitle: string; trimester: number; grade: number | null; status: string;
}
interface CoursesData { cursos: { id: number; nombre: string }[]; }
interface GradesData { grades: GradeData[]; }

export default function BoletinPage() {
  const params = useParams();
  const router = useRouter();
  const cursoId = parseInt(params.cursoId as string);

  const { data: coursesData } = useQuery<CoursesData, Error>({
    queryKey: ["admin-courses-boletin"],
    queryFn: async () => { const res = await apiFetch("/api/admin/courses"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: gradesData, isLoading } = useQuery<GradesData, Error>({
    queryKey: ["admin-grades", cursoId],
    queryFn: async () => { const res = await apiFetch(`/api/admin/grades?cursoId=${cursoId}&limit=1000`); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 2 * 60 * 1000,
  });

  const cursoNombre = coursesData?.cursos.find(c => c.id === cursoId)?.nombre || "";
  const grades = gradesData?.grades || [];

  const students = new Map<number, { name: string; cedula: string; subjects: Map<string, { emoji: string; t1: (number | null)[]; t2: (number | null)[]; t3: (number | null)[] }> }>();

  for (const g of grades) {
    if (!students.has(g.studentId)) {
      students.set(g.studentId, { name: g.studentName, cedula: g.studentCedula, subjects: new Map() });
    }
    const s = students.get(g.studentId)!;
    if (!s.subjects.has(g.subjectName)) {
      s.subjects.set(g.subjectName, { emoji: g.subjectEmoji, t1: [], t2: [], t3: [] });
    }
    const subj = s.subjects.get(g.subjectName)!;
    if (g.trimester === 1) subj.t1.push(g.grade);
    if (g.trimester === 2) subj.t2.push(g.grade);
    if (g.trimester === 3) subj.t3.push(g.grade);
  }

  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter(v => v !== null) as number[];
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const studentList = Array.from(students.entries()).map(([id, s]) => ({
    id, ...s,
    subjectsList: Array.from(s.subjects.entries()).map(([name, subj]) => ({
      name, emoji: subj.emoji,
      t1: avg(subj.t1), t2: avg(subj.t2), t3: avg(subj.t3),
      yearly: (() => {
        const t1a = avg(subj.t1); const t2a = avg(subj.t2); const t3a = avg(subj.t3);
        const vals = [t1a, t2a, t3a].filter(v => v !== null);
        return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      })(),
    })),
  }));

  if (isLoading) return (
    <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin" /></div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/cursos")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-2xl font-bold">Boletin de Notas</h1>
        </div>
        <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
      </div>

      <Card className="shadow-sm print:shadow-none print:border-0">
        <CardContent className="p-6 print:p-0">
          <div className="text-center mb-8 border-b pb-6">
            <h2 className="text-2xl font-bold">Atlas Edu - Boletin de Notas</h2>
            <p className="text-lg mt-1">Curso: {cursoNombre}</p>
            <p className="text-sm text-muted-foreground mt-2">{new Date().toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>

          {studentList.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Sin calificaciones registradas.</p>
          ) : (
            <div className="space-y-8">
              {studentList.map((st, si) => (
                <div key={st.id} className="page-break-inside-avoid">
                  <div className="border-b pb-2 mb-3">
                    <span className="text-sm font-bold text-muted-foreground">#{si + 1}</span>
                    <h3 className="text-lg font-bold">{st.name}</h3>
                    <p className="text-xs text-muted-foreground">Cedula: {st.cedula}</p>
                  </div>
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 border">Materia</th>
                        <th className="text-center p-2 border">T1</th>
                        <th className="text-center p-2 border">T2</th>
                        <th className="text-center p-2 border">T3</th>
                        <th className="text-center p-2 border font-bold">Prom. Anual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {st.subjectsList.map((subj, j) => (
                        <tr key={j} className="border">
                          <td className="p-2 border">{subj.emoji} {subj.name}</td>
                          <td className="text-center p-2 border">{subj.t1?.toFixed(2) || "—"}</td>
                          <td className="text-center p-2 border">{subj.t2?.toFixed(2) || "—"}</td>
                          <td className="text-center p-2 border">{subj.t3?.toFixed(2) || "—"}</td>
                          <td className="text-center p-2 border font-bold">
                            {subj.yearly?.toFixed(2) || "—"}
                            {subj.yearly !== null && (
                              <Badge variant={subj.yearly >= 7 ? "default" : "destructive"} className="ml-2 text-[10px]">
                                {subj.yearly >= 7 ? "APROBADO" : "REPROBADO"}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-8 text-xs text-muted-foreground">
                    <p>Firma del profesor tutor: _______________________</p>
                    <p className="mt-2">Firma del representante: _______________________</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
