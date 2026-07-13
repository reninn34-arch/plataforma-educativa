"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, AlertTriangle, Plus, Trash2, Save, Sparkles, CheckCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface Course {
  id: number;
  nombre: string;
  nivel: string;
  mySubjects: { subjectId: number; subjectName: string; subjectEmoji: string }[];
}

interface PreguntaData {
  type: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
  virtualType?: string;
}

interface Question {
  id: string;
  virtualType: "mcq" | "completar";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
}

let qCounter = 0;

function newQuestion(type: "mcq" | "completar" = "mcq"): Question {
  return {
    id: `q_${++qCounter}`,
    virtualType: type,
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    points: 1,
  };
}

export default function NuevoCuestionarioPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([newQuestion("mcq")]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [generating, setGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiQuestionCount, setAiQuestionCount] = useState(10);
  const [aiTypes, setAiTypes] = useState<string[]>(["mcq", "completar"]);
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    apiFetch("/api/teacher/courses")
      .then(r => r.json())
      .then(d => setCourses(d.cursos || []))
      .catch(() => {});
  }, []);

  const selectedCourse = courses.find(c => String(c.id) === cursoId);
  const availableSubjects = selectedCourse?.mySubjects || [];

  const addQuestion = (type: "mcq" | "completar") => {
    setQuestions(q => [...q, newQuestion(type)]);
  };

  const removeQuestion = (qId: string) => {
    if (questions.length <= 1) return;
    setQuestions(q => q.filter(qq => qq.id !== qId));
  };

  const updateQuestion = (qId: string, field: string, value: string | number | boolean) => {
    setQuestions(q => q.map(qq => (qq.id === qId ? { ...qq, [field]: value } : qq)));
  };

  const updateOption = (qId: string, idx: number, value: string) => {
    setQuestions(q => q.map(qq => {
      if (qq.id !== qId) return qq;
      const opts = [...qq.options];
      opts[idx] = value;
      return { ...qq, options: opts };
    }));
  };

  const handleGenerateAi = async () => {
    if (!subjectId || !aiTopic.trim()) {
      setError("Selecciona una materia y escribe un tema");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await apiFetch("/api/teacher/ai/generate-cuestionario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId: cursoId ? parseInt(cursoId) : undefined,
          subjectId: parseInt(subjectId),
          topic: aiTopic.trim(),
          questionCount: aiQuestionCount,
          questionTypes: aiTypes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al generar"); setGenerating(false); return; }
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.questions?.length) {
        setQuestions(data.questions.map((q: PreguntaData) => ({
          ...newQuestion(q.virtualType || "mcq"),
          id: `q_${++qCounter}`,
          question: q.question || "",
          options: (q.options as string[])?.length ? q.options : ["", "", "", ""],
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation || "",
          points: q.points || 1,
        })));
      }
      setShowAiPanel(false);
    } catch { setError("Error al conectar con la IA"); }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!subjectId) { setError("Selecciona una materia"); return; }
    if (!title.trim()) { setError("El titulo es requerido"); return; }
    if (questions.length === 0) { setError("Agrega al menos una pregunta"); return; }
    setSaving(true);
    setError("");

    try {
      const res = await apiFetch("/api/teacher/cuestionarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId: cursoId ? parseInt(cursoId) : null,
          subjectId: parseInt(subjectId),
          title: title.trim(),
          description: description.trim(),
          questions: questions.map((q, i) => ({
            virtualType: q.virtualType,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            points: q.points,
            orderIndex: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al crear"); setSaving(false); return; }
      router.push(`/teacher/cuestionarios/${data.cuestionarioId}`);
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

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
            <h1 className="text-xl font-bold text-foreground">Nuevo Cuestionario</h1>
            <p className="text-sm text-slate-400">{questions.length} preguntas</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Curso (opcional)</label>
              <select value={cursoId} onChange={e => { setCursoId(e.target.value); setSubjectId(""); }}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              >
                <option value="">Seleccionar curso...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} {c.nivel}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Materia *</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              >
                <option value="">Seleccionar materia...</option>
                {cursoId ? availableSubjects.map(ms => (
                  <option key={ms.subjectId} value={ms.subjectId}>{ms.subjectName}</option>
                )) : courses.flatMap(c => c.mySubjects).filter((ms, i, arr) => arr.findIndex(x => x.subjectId === ms.subjectId) === i).map(ms => (
                  <option key={ms.subjectId} value={ms.subjectId}>{ms.subjectName}</option>
                ))}
              </select>
              {!cursoId && availableSubjects.length === 0 && (
                <p className="text-[10px] text-slate-400 mt-1">Selecciona un curso para ver sus materias</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Titulo *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              placeholder="Ej: Cuestionario: Ecuaciones de primer grado" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Descripcion</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm resize-y focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              placeholder="Instrucciones para el estudiante (opcional)" />
          </div>

          {!showAiPanel ? (
            <Button onClick={() => setShowAiPanel(true)} variant="outline"
              className="w-full gap-2 rounded-xl border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 py-6">
              <Sparkles className="h-5 w-5" />
              Generar preguntas con IA
            </Button>
          ) : (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Generar con IA
                </h3>
                <button onClick={() => setShowAiPanel(false)} className="text-xs text-indigo-500 hover:text-indigo-700">Cerrar</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Tema *</label>
                  <input type="text" value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                    placeholder="Ej: Simple Past, La celula,..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Preguntas</label>
                  <input type="number" value={aiQuestionCount} onChange={e => setAiQuestionCount(Math.min(20, Math.max(3, parseInt(e.target.value) || 5)))}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none" min={3} max={20} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Tipos de pregunta</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={aiTypes.includes("mcq")}
                      onChange={() => setAiTypes(t => t.includes("mcq") ? t.filter(x => x !== "mcq") : [...t, "mcq"])}
                      className="accent-indigo-600" />
                    Opcion multiple
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={aiTypes.includes("completar")}
                      onChange={() => setAiTypes(t => t.includes("completar") ? t.filter(x => x !== "completar") : [...t, "completar"])}
                      className="accent-amber-500" />
                    Completar
                  </label>
                </div>
              </div>
              <Button onClick={handleGenerateAi} disabled={generating || !aiTopic.trim() || !subjectId}
                className="w-full gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Generando..." : "Generar"}
              </Button>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Preguntas</h2>
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">{questions.length}</Badge>
          </div>

          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {q.virtualType === "completar" ? "Completar" : "Opcion multiple"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" value={q.points}
                    onChange={e => updateQuestion(q.id, "points", Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 rounded-lg border border-border px-2 py-1 text-xs text-center focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 focus:outline-none" min={1} max={20} />
                  <span className="text-[10px] text-muted-foreground">pts</span>
                  <div className="flex gap-1">
                    <button onClick={() => {
                      const newType = q.virtualType === "completar" ? "mcq" : "completar";
                      updateQuestion(q.id, "virtualType", newType);
                    }} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors" title="Cambiar tipo">
                      <ListChecks size={14} />
                    </button>
                    {questions.length > 1 && (
                      <button onClick={() => removeQuestion(q.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <input type="text" value={q.question}
                onChange={e => updateQuestion(q.id, "question", e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                placeholder={q.virtualType === "completar" ? "Ej: La capital de Francia es ___" : "Escribe la pregunta..."} />

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {q.virtualType === "completar" ? "Opciones (una completa la frase)" : "Opciones (marca la correcta)"}
                </p>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2 mb-1.5">
                    <input type="radio" name={`opt_${q.id}`} checked={q.correctIndex === oi}
                      onChange={() => updateQuestion(q.id, "correctIndex", oi)}
                      className="shrink-0 accent-indigo-600" />
                    <span className="w-5 text-xs font-bold text-muted-foreground shrink-0">{String.fromCharCode(65 + oi)})</span>
                    <input type="text" value={opt}
                      onChange={e => updateOption(q.id, oi, e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 focus:outline-none"
                      placeholder={`Opcion ${String.fromCharCode(65 + oi)}`} />
                    {q.correctIndex === oi && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Explicacion</label>
                <textarea value={q.explanation} onChange={e => updateQuestion(q.id, "explanation", e.target.value)} rows={2}
                  className="w-full rounded-xl border border-border bg-indigo-50/50 px-3 py-2 text-sm resize-y focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  placeholder="Explica por que esta es la respuesta correcta..." />
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button onClick={() => addQuestion("mcq")} variant="outline" className="flex-1 gap-2 rounded-xl border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              <Plus className="h-4 w-4" /> Opcion multiple
            </Button>
            <Button onClick={() => addQuestion("completar")} variant="outline" className="flex-1 gap-2 rounded-xl border-dashed border-amber-200 text-amber-600 hover:bg-amber-50">
              <Plus className="h-4 w-4" /> Completar
            </Button>
          </div>
        </div>

        <div className="flex justify-center gap-3 pt-4">
          <Button onClick={() => router.push("/teacher/cuestionarios")} variant="outline" className="rounded-xl gap-2">
            <ArrowLeft className="h-4 w-4" /> Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md shadow-indigo-200">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Crear Cuestionario
          </Button>
        </div>
      </div>
    </div>
  );
}
