"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Users as UsersIcon, BookOpen, Upload, FileText, Trash2, Check, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

interface Bloque {
  id: number; dia: string; horaInicio: string; horaFin: string;
  subjectId: number | null; subjectName: string | null; subjectEmoji: string | null;
  tipo: string; cursoId: number;
}

interface CursoInfo {
  id: number; nombre: string; nivel: string; profesorId: number | null;
  profesorNombre: string | null; studentCount: number; isTutor: boolean;
  teacherSubjects: { teacherId: number; teacherName: string; subjectId: number; subjectName: string; subjectEmoji: string }[];
  mySubjects: { teacherId: number; teacherName: string; subjectId: number; subjectName: string; subjectEmoji: string }[];
}

interface CoursesData { cursos: CursoInfo[]; }
interface HorarioData { horarios: Bloque[]; }
interface StudyMaterial { id: number; subjectId: number; title: string; content: string; fileType: string; createdAt: string; }

export default function TeacherCursosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalCursoId, setModalCursoId] = useState<number | null>(null);
  const [modalSubject, setModalSubject] = useState<{ id: number; name: string; emoji: string } | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  const cursos = coursesData?.cursos || [];
  const horarios = horarioData?.horarios || [];

  const { data: materialMap } = useQuery<Record<string, StudyMaterial>>({
    queryKey: ["teacher-material-map", cursos.map(c => c.id)],
    queryFn: async () => {
      const map: Record<string, StudyMaterial> = {};
      await Promise.all(cursos.map(async (curso) => {
        const res = await apiFetch(`/api/teacher/study-material?cursoId=${curso.id}`);
        if (res.ok) {
          const data: { materials: StudyMaterial[] } = await res.json();
          for (const m of data.materials) {
            map[`${curso.id}-${m.subjectId}`] = m;
          }
        }
      }));
      return map;
    },
    enabled: cursos.length > 0,
  });

  const { data: modalMaterial } = useQuery<StudyMaterial | null>({
    queryKey: ["teacher-study-material", modalCursoId, modalSubject?.id],
    queryFn: async () => {
      if (!modalCursoId || !modalSubject?.id) return null;
      const res = await apiFetch(`/api/teacher/study-material?cursoId=${modalCursoId}&subjectId=${modalSubject.id}`);
      if (!res.ok) return null;
      const data: { materials: StudyMaterial[] } = await res.json();
      return data.materials?.[0] || null;
    },
    enabled: !!modalCursoId && !!modalSubject?.id,
  });

  const isLoading = coursesLoading || horarioLoading;

  const schedule: Record<number, Bloque[]> = {};
  for (const h of horarios) {
    if (!schedule[h.cursoId]) schedule[h.cursoId] = [];
    schedule[h.cursoId].push(h);
  }

  const openMaterialModal = (cursoId: number, subject: { id: number; name: string; emoji: string }) => {
    setModalCursoId(cursoId);
    setModalSubject(subject);
    setPastedText("");
    setFeedback("");
    setSelectedPdf(null);
  };

  const handleSaveText = async () => {
    if (!modalCursoId || !modalSubject || !pastedText.trim()) return;
    setUploading(true);
    setFeedback("");
    try {
      const res = await apiFetch("/api/teacher/study-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId: modalCursoId,
          subjectId: modalSubject.id,
          title: `Material de ${modalSubject.name}`,
          content: pastedText,
        }),
      });
      if (res.ok) {
        setFeedback("Material guardado correctamente");
        queryClient.invalidateQueries({ queryKey: ["teacher-material-map"] });
        queryClient.invalidateQueries({ queryKey: ["teacher-study-material"] });
      } else {
        const d = await res.json();
        setFeedback(d.error || "Error al guardar");
      }
    } catch {
      setFeedback("Error de conexión");
    }
    setUploading(false);
  };

  const handleUploadPdf = async () => {
    if (!modalCursoId || !modalSubject || !selectedPdf) return;
    setUploading(true);
    setFeedback("");
    try {
      const formData = new FormData();
      formData.append("cursoId", String(modalCursoId));
      formData.append("subjectId", String(modalSubject.id));
      formData.append("file", selectedPdf);
      const res = await apiFetch("/api/teacher/study-material", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setFeedback("PDF subido correctamente");
        setSelectedPdf(null);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
        queryClient.invalidateQueries({ queryKey: ["teacher-material-map"] });
        queryClient.invalidateQueries({ queryKey: ["teacher-study-material"] });
      } else {
        const d = await res.json();
        setFeedback(d.error || "Error al subir PDF");
        setSelectedPdf(null);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
      }
    } catch {
      setFeedback("Error de conexión");
    }
    setUploading(false);
  };

  const handleDeleteMaterial = async (id: number) => {
    if (!confirm("¿Eliminar este material de estudio?")) return;
    try {
      const res = await apiFetch(`/api/teacher/study-material/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFeedback("Material eliminado");
        queryClient.invalidateQueries({ queryKey: ["teacher-material-map"] });
        queryClient.invalidateQueries({ queryKey: ["teacher-study-material"] });
      }
    } catch {
      setFeedback("Error al eliminar");
    }
  };

  const closeModal = () => {
    setModalCursoId(null);
    setModalSubject(null);
    setPastedText("");
    setFeedback("");
    setSelectedPdf(null);
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando cursos...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Mis Cursos</h1>
              <p className="text-sm text-slate-400">{cursos.length} {cursos.length === 1 ? "curso asignado" : "cursos asignados"}</p>
            </div>
          </div>
        </div>

        {cursos.length === 0 ? (
          <Card className="shadow-sm border-slate-200">
            <CardContent className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto">
                <BookOpen size={32} className="text-slate-300" />
              </div>
              <p className="font-semibold text-slate-600">No tienes cursos asignados</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {cursos.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-800">{c.nombre}</h3>
                        <p className="text-sm text-slate-400">{c.nivel}</p>
                      </div>
                      <div className="flex gap-1">
                        {c.isTutor && <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-100">Tutor</Badge>}
                        <Badge variant="secondary" className="text-[10px] flex items-center gap-1 bg-slate-50 text-slate-600"><UsersIcon className="h-3 w-3" /> {c.studentCount}</Badge>
                      </div>
                    </div>
                  </div>

                  {schedule[c.id] && schedule[c.id].length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Horario</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] border-collapse">
                          <thead>
                            <tr>
                              {["lun","mar","mie","jue","vie"].map(d => (
                                <th key={d} className="p-1 border border-slate-100 bg-slate-50 text-center font-semibold text-slate-500 capitalize">{d}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {["lunes","martes","miercoles","jueves","viernes"].map(dia => {
                                const bloques = schedule[c.id].filter((h: Bloque) => h.dia === dia);
                                return (
                                  <td key={dia} className="p-1 border border-slate-100 align-top">
                                    {bloques.length === 0 ? <span className="text-slate-300">—</span> : (
                                      <div className="space-y-0.5">
                                        {bloques.map((b: Bloque, i: number) => (
                                          <div key={i} className="text-center leading-tight">
                                            <span>{b.subjectEmoji}</span>
                                            <div className="text-[10px] text-slate-400">{b.horaInicio}</div>
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
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Tus materias</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.mySubjects.map((s, i) => {
                          const hasMaterial = materialMap?.[`${c.id}-${s.subjectId}`];
                          const theme = subjectTheme(s.subjectName.toLowerCase());
                          return (
                            <button
                              key={i}
                              onClick={() => openMaterialModal(c.id, { id: s.subjectId, name: s.subjectName, emoji: s.subjectEmoji })}
                              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                hasMaterial
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : `${theme.border} ${theme.bgLight} ${theme.text} hover:bg-white`
                              }`}
                              title={hasMaterial ? "Ver o cambiar material de estudio" : "Subir material de estudio"}
                            >
                              <span>{s.subjectEmoji}</span>
                              <span>{s.subjectName}</span>
                              {hasMaterial ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Upload className="h-3 w-3 ml-0.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {c.teacherSubjects.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Todos los profesores</p>
                      <div className="flex flex-wrap gap-1">
                        {c.teacherSubjects.map((ts, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] py-0.5 gap-1 border-slate-200 text-slate-600">
                            <span>{ts.subjectEmoji}</span><span>{ts.subjectName}</span><span className="text-slate-400">· {ts.teacherName}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => router.push(`/teacher/dashboard?cursoId=${c.id}`)}>
                      Ver estudiantes <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Material Modal */}
      <Dialog open={!!modalCursoId && !!modalSubject} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-indigo-500" />
              Material de estudio: {modalSubject?.emoji} {modalSubject?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {feedback && (
              <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                feedback.includes("Error") || feedback.includes("error")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}>
                {feedback}
              </div>
            )}

            {modalMaterial && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-800">{modalMaterial.title}</span>
                    <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600">{modalMaterial.fileType === "pdf" ? "PDF" : "Texto"}</Badge>
                  </div>
                  <button onClick={() => handleDeleteMaterial(modalMaterial.id)}
                    className="p-1 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                    title="Eliminar material">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-indigo-600">Subido el {new Date(modalMaterial.createdAt).toLocaleDateString("es-ES")}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-2">
                {modalMaterial ? "Editar o reemplazar contenido" : "Pega el contenido del material"}
              </label>
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-y focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                placeholder="Copia aquí el texto del material de estudio..."
              />
            </div>

            <Button onClick={handleSaveText} disabled={uploading || !pastedText.trim() || pastedText === modalMaterial?.content} className="w-full gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {modalMaterial ? "Actualizar material" : "Guardar material"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">o sube un PDF</span></div>
            </div>

            <div className="space-y-3">
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                onChange={e => setSelectedPdf(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
              {selectedPdf && (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-700">{selectedPdf.name}</span>
                    <span className="text-xs text-slate-400">({(selectedPdf.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setSelectedPdf(null); if (pdfInputRef.current) pdfInputRef.current.value = ""; }}
                      className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                      title="Quitar archivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <Button size="sm" onClick={handleUploadPdf} disabled={uploading} className="gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Subir PDF
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeModal} className="rounded-xl">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
