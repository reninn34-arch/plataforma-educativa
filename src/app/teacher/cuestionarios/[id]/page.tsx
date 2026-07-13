"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle, Loader2, AlertTriangle, GraduationCap, Trash2, Pencil, Download, FileText, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface CuestionarioDetail {
  id: number;
  title: string;
  description: string;
  subjectName: string;
  subjectEmoji: string;
  subjectSlug: string;
  cursoNombre: string;
  cursoNivel: string;
  teacherName: string;
  createdAt: string;
}

interface Pregunta {
  id: number;
  type: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  orderIndex: number;
}

export default function TeacherCuestionarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [cuestionario, setCuestionario] = useState<CuestionarioDetail | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  useEffect(() => {
    apiFetch(`/api/teacher/cuestionarios/${id}`)
      .then(r => r.json())
      .then(d => {
        setCuestionario(d.cuestionario);
        setPreguntas(d.preguntas || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este cuestionario de estudio? Los estudiantes ya no podrán acceder a él.")) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/teacher/cuestionarios/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/teacher/cuestionarios");
    } catch {}
    setDeleting(false);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/teacher/cuestionarios/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuestionario-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Error al descargar PDF"); }
    setDownloadingPdf(false);
  };

  const handleDownloadWord = async () => {
    setDownloadingWord(true);
    try {
      const res = await fetch(`/api/teacher/cuestionarios/${id}/word`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuestionario-${id}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Error al descargar Word"); }
    setDownloadingWord(false);
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  if (!cuestionario) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <AlertTriangle className="h-10 w-10 text-slate-300" />
      <p className="text-slate-500">Cuestionario no encontrado</p>
      <Button variant="outline" onClick={() => router.push("/teacher/cuestionarios")} className="rounded-xl border-slate-200">Volver</Button>
    </div>
  );

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/teacher/cuestionarios")}
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{cuestionario.title}</h1>
            <p className="text-sm text-slate-400">
              {cuestionario.subjectName}{cuestionario.cursoNombre ? ` · ${cuestionario.cursoNombre}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => router.push(`/teacher/cuestionarios/${id}/edit`)}
              variant="outline"
              className="gap-2 rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              variant="outline"
              className="gap-2 rounded-xl border-slate-200"
            >
              {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              PDF
            </Button>
            <Button
              onClick={handleDownloadWord}
              disabled={downloadingWord}
              variant="outline"
              className="gap-2 rounded-xl border-slate-200"
            >
              {downloadingWord ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Word
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="outline"
              className="gap-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 gap-1 rounded-lg">
                <GraduationCap className="h-3 w-3" />
                {preguntas.length} preguntas
              </Badge>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 rounded-lg">
                <ListChecks className="h-3 w-3" />
                {preguntas.filter(p => p.type === "completar").length} completar
              </Badge>
            {cuestionario.createdAt && (
              <span className="text-xs text-slate-400">
                Creado: {new Date(cuestionario.createdAt).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
          </div>
          {cuestionario.description && (
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{cuestionario.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{cuestionario.subjectName}</span>
            {cuestionario.cursoNombre && (
              <span>{cuestionario.cursoNombre} {cuestionario.cursoNivel}</span>
            )}
          </div>
        </div>

        {preguntas.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-500" /> Preguntas
            </h2>
            {preguntas.map((p, i) => {
              const options = p.options || [];
              return (
                <div key={p.id} className="space-y-3 pb-5 border-b border-border last:border-b-0 last:pb-0">
                  <p className="text-sm font-semibold text-foreground">
                    <span className="text-indigo-500 mr-2">{i + 1}.</span>
                    {p.question}
                    <Badge variant="secondary" className="ml-2 text-[10px] align-middle">
                      {p.type === "completar" ? "Completar" : "Opcion multiple"}
                    </Badge>
                  </p>
                  <div className="grid gap-2">
                    {options.map((opt, oi) => {
                      const isCorrect = oi === p.correctIndex;
                      return (
                        <div
                          key={oi}
                          className={`flex items-center gap-3 w-full rounded-xl border-2 p-3 text-left text-sm transition-all ${
                            isCorrect
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-slate-200 bg-card"
                          }`}
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isCorrect
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-muted-foreground"
                          }`}>
                            {isCorrect ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              String.fromCharCode(65 + oi)
                            )}
                          </span>
                          <span className={`font-medium ${isCorrect ? "text-emerald-800" : "text-foreground"}`}>
                            {opt}
                            {isCorrect && (
                              <span className="ml-2 text-[10px] text-emerald-600 font-bold">(CORRECTA)</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {p.explanation && (
                    <div className="flex gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                      <span className="text-sm shrink-0 mt-0.5">💡</span>
                      <p className="text-xs text-indigo-700 leading-relaxed">{p.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-center">
          <Button
            onClick={() => router.push("/teacher/cuestionarios")}
            variant="outline"
            className="rounded-xl border-slate-200 gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a cuestionarios
          </Button>
        </div>
      </div>
    </div>
  );
}
