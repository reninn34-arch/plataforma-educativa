"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Printer, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/admin/cursos")} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Boletín de Notas</h1>
        </div>
        <Button onClick={() => window.print()} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"><Printer className="h-4 w-4" /> Imprimir</Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-0">
        <div className="p-6 print:p-0">
          <div className="text-center mb-8 border-b border-slate-100 pb-6">
            <h2 className="text-2xl font-bold text-slate-800">Atlas Edu — Boletín de Notas</h2>
            <p className="text-lg mt-1 text-slate-600">Curso: {cursoNombre}</p>
            <p className="text-sm text-slate-400 mt-2">{new Date().toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>

          {studentList.length === 0 ? (
            <p className="text-center text-slate-400 py-12">Sin calificaciones registradas.</p>
          ) : (
            <div className="space-y-8">
              {studentList.map((st, si) => (
                <div key={st.id} className="page-break-inside-avoid">
                  <div className="border-b border-slate-200 pb-2 mb-3">
                    <span className="text-sm font-bold text-slate-400">#{si + 1}</span>
                    <h3 className="text-lg font-bold text-slate-800">{st.name}</h3>
                    <p className="text-xs text-slate-400">Cédula: {st.cedula}</p>
                  </div>
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left p-2 border border-slate-200 text-slate-600 font-semibold">Materia</th>
                        <th className="text-center p-2 border border-slate-200 text-slate-600 font-semibold">T1</th>
                        <th className="text-center p-2 border border-slate-200 text-slate-600 font-semibold">T2</th>
                        <th className="text-center p-2 border border-slate-200 text-slate-600 font-semibold">T3</th>
                        <th className="text-center p-2 border border-slate-200 font-bold text-slate-700">Prom. Anual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {st.subjectsList.map((subj, j) => (
                        <tr key={j} className="border-b border-slate-100 last:border-0">
                          <td className="p-2 border-r border-slate-100 text-slate-700">{subj.emoji} {subj.name}</td>
                          <td className="text-center p-2 border-r border-slate-100 text-slate-600">{subj.t1?.toFixed(2) || "—"}</td>
                          <td className="text-center p-2 border-r border-slate-100 text-slate-600">{subj.t2?.toFixed(2) || "—"}</td>
                          <td className="text-center p-2 border-r border-slate-100 text-slate-600">{subj.t3?.toFixed(2) || "—"}</td>
                          <td className="text-center p-2 font-bold text-slate-800">
                            {subj.yearly?.toFixed(2) || "—"}
                            {subj.yearly !== null && (
                              <Badge variant={subj.yearly >= 7 ? "default" : "destructive"} className="ml-2 text-[10px] rounded-lg">
                                {subj.yearly >= 7 ? "APROBADO" : "REPROBADO"}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-8 text-xs text-slate-400">
                    <p>Firma del profesor tutor: _______________________</p>
                    <p className="mt-2">Firma del representante: _______________________</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
