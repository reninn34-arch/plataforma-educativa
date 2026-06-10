"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, BookOpen, CheckCircle, Loader2, AlertTriangle, GraduationCap, User, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

interface CuestionarioDetail {
  id: number;
  title: string;
  description: string;
  subjectName: string;
  subjectEmoji: string;
  subjectSlug: string;
  cursoNombre: string;
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

export default function CuestionarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [cuestionario, setCuestionario] = useState<CuestionarioDetail | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiFetch(`/api/student/cuestionarios/${id}`)
      .then(r => r.json())
      .then(d => {
        setCuestionario(d.cuestionario);
        setPreguntas(d.preguntas || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/student/cuestionarios/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al descargar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuestionario-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar el PDF");
    }
    setDownloading(false);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  if (!cuestionario) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-4">
      <AlertTriangle className="h-10 w-10 text-slate-300" />
      <p className="text-slate-500">Cuestionario no encontrado</p>
      <Button variant="outline" onClick={() => router.push("/student/cuestionarios")} className="rounded-xl border-slate-200">Volver</Button>
    </div>
  );

  const theme = subjectTheme(cuestionario.subjectSlug);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className={`sticky top-0 z-20 bg-gradient-to-r ${theme.header} shadow-lg`}>
        <div className="flex h-14 items-center gap-3 px-4 max-w-3xl mx-auto w-full">
          <button onClick={() => router.push("/student/cuestionarios")} className="text-white/80 hover:bg-white/15 p-2 rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl shrink-0">{cuestionario.subjectEmoji}</span>
            <div className="min-w-0">
              <span className="text-base font-bold text-white truncate block">{cuestionario.subjectName}</span>
              <p className="text-xs text-white/70 truncate">
                {cuestionario.cursoNombre || "Cuestionario de estudio"}
              </p>
            </div>
          </div>
          <Button
            onClick={handleDownloadPdf}
            disabled={downloading}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-none gap-1.5 rounded-lg shrink-0"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-6 animate-fade-in-up">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-lg font-bold text-slate-800">{cuestionario.title}</h1>
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 shrink-0 gap-1 rounded-lg">
              <GraduationCap className="h-3 w-3" />
              {preguntas.length} preguntas
            </Badge>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0 gap-1 rounded-lg">
              <ListChecks className="h-3 w-3" />
              {preguntas.filter(p => p.type === "completar").length} completar
            </Badge>
          </div>
          {cuestionario.description && (
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{cuestionario.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{cuestionario.teacherName}</span>
            <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{cuestionario.subjectName}</span>
            {cuestionario.createdAt && (
              <span>{new Date(cuestionario.createdAt).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}</span>
            )}
          </div>
        </div>

        {preguntas.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-500" /> Preguntas de Estudio
            </h2>
            {preguntas.map((p, i) => {
              const options = p.options || [];
              return (
                <div key={p.id} className="space-y-3 pb-5 border-b border-slate-100 last:border-b-0 last:pb-0">
                  <p className="text-sm font-semibold text-slate-700">
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
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isCorrect
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {isCorrect ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              String.fromCharCode(65 + oi)
                            )}
                          </span>
                          <span className={`font-medium ${isCorrect ? "text-emerald-800" : "text-slate-700"}`}>
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

        <div className="flex justify-center pb-8">
          <Button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md shadow-indigo-200 px-8"
          >
            {downloading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            {downloading ? "Descargando..." : "Descargar PDF"}
          </Button>
        </div>
      </main>
    </div>
  );
}
