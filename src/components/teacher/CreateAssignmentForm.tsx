"use client";

import { useState, useEffect } from "react";
import {
  Plus, Loader2, CheckCircle, Calendar, BookOpen, FileText, Download,
  ArrowLeft, Trash2, ListChecks, Upload, FileUp,
  Pencil, X, AlertCircle, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DueTimer } from "@/components/DueTimer";
import { apiFetch } from "@/lib/fetch-utils";

interface SubjectData {
  id: number;
  slug: string;
  name: string;
  emoji: string;
}

interface CursoData {
  id: number;
  nombre: string;
  nivel: string;
  mySubjects: { subjectId: number; subjectName: string; subjectEmoji: string }[];
}

interface Question {
  id: string;
  type: "mcq" | "file_upload";
  question: string;
  options: string[];
  correctIndex: number;
  points: number;
  dbId?: number;
}

interface Assignment {
  id: number;
  title: string;
  description: string;
  dueDate: string | null;
  subjectId?: number;
  subjectName: string;
  subjectEmoji: string;
  subjectSlug: string;
  cursoId?: number | null;
  cursoNombre?: string | null;
  periodoNombre?: string | null;
  submissionCount?: number;
  puntos?: number;
  trimester?: number;
}

interface Submission {
  id: number;
  studentName: string;
  studentCedula: string;
  content?: string;
  fileUrl?: string;
  status: string;
  submittedAt?: string;
  grade?: number;
  feedback?: string;
  answers?: { question: string; selectedIndex: number; isCorrect: boolean; correctIndex: number }[];
  mcqScore?: number;
  mcqTotal?: number;
}

let qCounter = 0;
function newMcq(): Question {
  return { id: `q_${++qCounter}`, type: "mcq", question: "", options: ["", "", "", ""], correctIndex: 0, points: 1 };
}
function newFileQ(): Question {
  return { id: `q_${++qCounter}`, type: "file_upload", question: "", options: [], correctIndex: 0, points: 5 };
}

export function CreateAssignmentForm() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [cursoId, setCursoId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [trimester, setTrimester] = useState(1);
  const [puntos, setPuntos] = useState(10);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [subjectsList, setSubjectsList] = useState<SubjectData[]>([]);
  const [cursosList, setCursosList] = useState<CursoData[]>([]);
  const [activePeriod, setActivePeriod] = useState<string | null>(null);

  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [notSubmitted, setNotSubmitted] = useState<{ studentId: number; studentName: string; studentCedula: string; expired: boolean }[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [gradingSub, setGradingSub] = useState<{ id?: number; studentId?: number; grade: number; feedback: string } | null>(null);
  const [absentLoading, setAbsentLoading] = useState<number | null>(null);

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  const filteredSubjects = cursoId
    ? subjectsList.filter(s =>
        cursosList.find(c => c.id === cursoId)?.mySubjects?.some(ms => ms.subjectId === s.id)
      )
    : subjectsList;

  useEffect(() => {
    if (cursoId && filteredSubjects.length > 0) {
      const currentIsValid = filteredSubjects.some(s => s.id === subjectId);
      if (!currentIsValid) setSubjectId(filteredSubjects[0].id);
    }
  }, [cursoId]);

  const handleMarkAbsent = async (studentId: number) => {
    setAbsentLoading(studentId);
    try {
      const res = await apiFetch(`/api/assignments/${selectedAssignment}/mark-absent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (res.ok) {
        viewSubmissions(selectedAssignment!);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Error al marcar");
      }
    } catch {
      setErrorMsg("Error de conexion");
    }
    setAbsentLoading(null);
  };

  const handleAiGenerate = async () => {
    if (!aiTopic.trim() || !subjectId) {
      setAiError("Ingresa un tema y selecciona una materia");
      return;
    }
    setAiGenerating(true);
    setAiError("");

    const selectedSubject = subjectsList.find(s => s.id === subjectId);
    const subjectName = selectedSubject?.name || "";

    try {
      const res = await apiFetch("/api/teacher/ai/generate-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectName,
          topic: aiTopic.trim(),
          questionCount: aiQuestionCount,
          trimester,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setAiError(d.error || "Error al generar");
        setAiGenerating(false);
        return;
      }

      const data = d.data;
      setTitle(data.title || "");
      setDescription(data.description || "");
      const generatedQuestions: Question[] = (data.questions || []).map(
        (q: any, i: number) => ({
          id: `q_ai_${++qCounter}`,
          type: q.type,
          question: q.question,
          options: q.type === "mcq" ? q.options : [],
          correctIndex: q.type === "mcq" ? q.correctIndex : 0,
          points: q.points || 1,
        })
      );
      setQuestions(generatedQuestions);
      setShowAiPanel(false);
      setAiTopic("");
      setFeedback("Tarea generada con IA. Revisa y edita antes de publicar.");
      setTimeout(() => setFeedback(""), 4000);
    } catch {
      setAiError("Error de conexion");
    }
    setAiGenerating(false);
  };

  const handleGrade = async (submissionId: number | null, studentId: number | null, grade: number, feedback: string) => {
    try {
      const gradeInt = Math.round(grade);
      const body: any = { grade: gradeInt, feedback };
      if (submissionId) body.submissionId = submissionId;
      if (studentId) body.studentId = studentId;

      const res = await apiFetch(`/api/assignments/${selectedAssignment}/grade`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setErrorMsg(d.error || "Error al calificar");
      }
      setGradingSub(null);
      viewSubmissions(selectedAssignment!);
    } catch {
      setErrorMsg("Error de conexion al calificar");
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/assignments");
      const data = await res.json();
      if (data.assignments) setAssignments(data.assignments);
    } catch {
      setErrorMsg("Error al cargar tareas");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
    apiFetch("/api/subjects").then(r => r.json()).then(d => {
      if (d.subjects && d.subjects.length > 0) {
        setSubjectsList(d.subjects);
        setSubjectId(d.subjects[0].id);
      }
    }).catch(() => {});
    apiFetch("/api/teacher/courses").then(r => r.json()).then(d => {
      setCursosList(d.cursos || []);
    }).catch(() => {});

    apiFetch("/api/teacher/periodos").then(r => r.json()).then(d => {
      if (d.active) setActivePeriod(d.active.nombre);
    }).catch(() => {});
  }, []);

  const viewSubmissions = async (aid: number) => {
    setSelectedAssignment(aid);
    setLoadingSubs(true);
    try {
      const res = await apiFetch(`/api/assignments/${aid}`);
      const data = await res.json();
      if (data.submissions) setSubmissions(data.submissions);
      if (data.notSubmitted) setNotSubmitted(data.notSubmitted);
    } catch {
      setErrorMsg("Error al cargar entregas");
    }
    setLoadingSubs(false);
  };

  const handleDelete = async (aid: number) => {
    setDeleteConfirm(null);
    try {
      const res = await apiFetch(`/api/assignments/${aid}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setErrorMsg(d.error || "Error al eliminar");
        return;
      }
      setFeedback("Tarea eliminada");
      fetchAssignments();
      setTimeout(() => setFeedback(""), 3000);
    } catch {
      setErrorMsg("Error de conexion al eliminar");
    }
  };

  const startEdit = async (a: Assignment) => {
    setEditId(a.id);
    setTitle(a.title);
    setDescription(a.description);
    setDueDate(a.dueDate || "");
    setSubjectId(a.subjectId || subjectsList[0]?.id || null);
    setCursoId(a.cursoId || null);
    setTrimester(a.trimester || 1);
    setPuntos(a.puntos || 10);
    setShowForm(true);
    setErrorMsg("");

    try {
      const res = await apiFetch(`/api/assignments/${a.id}`);
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions.map((q: any) => ({
          id: `q_${q.id}`,
          type: q.type,
          question: q.question,
          options: q.options || ["", "", "", ""],
          correctIndex: q.correctIndex ?? 0,
          points: q.points || 1,
          dbId: q.id,
        })));
      }
    } catch {
      setErrorMsg("Error al cargar preguntas");
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setShowForm(false);
    setTitle("");
    setDescription("");
    setDueDate("");
    setQuestions([]);
    setCursoId(null);
    setSubjectId(subjectsList[0]?.id ?? null);
    setErrorMsg("");
  };

  const addQuestion = (type: "mcq" | "file_upload") => {
    setQuestions(q => [...q, type === "mcq" ? newMcq() : newFileQ()]);
  };
  const removeQuestion = (id: string) => {
    setQuestions(q => q.filter(qq => qq.id !== id));
  };
  const updateQuestion = (id: string, field: string, value: any) => {
    setQuestions(q => q.map(qq => qq.id === id ? { ...qq, [field]: value } : qq));
  };
  const updateOption = (qId: string, idx: number, value: string) => {
    setQuestions(q => q.map(qq => {
      if (qq.id !== qId) return qq;
      const opts = [...qq.options];
      opts[idx] = value;
      return { ...qq, options: opts };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    setFeedback("");

    const body = {
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate || null,
      trimester,
      questions: questions.map((q, i) => ({
        type: q.type,
        question: q.question,
        options: q.type === "mcq" ? q.options : null,
        correctIndex: q.type === "mcq" ? q.correctIndex : null,
        points: q.points,
        orderIndex: i,
      })),
    };

    try {
      const url = editId ? `/api/assignments/${editId}` : "/api/assignments";
      const method = editId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, subjectId, puntos, cursoId: cursoId || undefined }),
      });

      if (res.ok) {
        cancelEdit();
        setFeedback(editId ? "Tarea actualizada" : "Tarea creada exitosamente");
        fetchAssignments();
        setTimeout(() => setFeedback(""), 3000);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Error al guardar");
      }
    } catch {
      setErrorMsg("Error de conexion al guardar");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {feedback && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle className="h-4 w-4" /> {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle className="h-4 w-4" /> {errorMsg}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="max-w-sm mx-4 shadow-xl animate-scale-in">
            <CardContent className="p-6 space-y-4 text-center">
              <Trash2 className="mx-auto h-10 w-10 text-destructive" />
              <p className="font-bold text-foreground">Eliminar tarea</p>
              <p className="text-sm text-muted-foreground">Esta accion no se puede deshacer. Se eliminaran todas las entregas de estudiantes.</p>
              <div className="flex gap-3">
                <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)} className="flex-1">Eliminar</Button>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedAssignment ? (
        <div className="space-y-4">
          <button onClick={() => setSelectedAssignment(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a tareas
          </button>
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base">Entregas recibidas</CardTitle></CardHeader>
            <CardContent>
              {loadingSubs ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {submissions.length === 0 ? (
                    <div className="py-8 text-center">
                      <FileText className="mx-auto h-8 w-8 text-muted-foreground/30" />
                      <p className="mt-2 text-sm text-muted-foreground">Sin entregas aun</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {submissions.map((s, i) => (
                        <Card key={i} className="shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                              {s.studentName?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{s.studentName}</p>
                              <p className="text-xs text-muted-foreground">{s.submittedAt ? new Date(s.submittedAt).toLocaleString("es-EC") : "Sin entregar"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.fileUrl && (
                              <a href={s.fileUrl} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90">
                                <Download className="h-3 w-3" /> Archivo
                              </a>
                            )}
                            {s.mcqTotal !== undefined && s.mcqTotal > 0 && (
                              <Badge variant={s.mcqScore === s.mcqTotal ? "default" : "outline"}>{s.mcqScore}/{s.mcqTotal} MCQ</Badge>
                            )}
                            {s.grade !== null && s.grade !== undefined && (
                              <Badge variant={s.grade >= 7 ? "default" : "destructive"}>Nota: {s.grade}/10</Badge>
                            )}
                          </div>
                        </div>
                        {s.answers && s.answers.length > 0 && (
                          <div className="border-t pt-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">Respuestas:</p>
                            {s.answers.map((a, j) => (
                              <div key={j} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${a.isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                <span className="font-medium">{a.isCorrect ? "✅" : "❌"}</span>
                                <span className="flex-1 truncate">{a.question}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {(s.status === "submitted" || s.status === "graded") && (
                          <div className="border-t pt-3 space-y-2">
                            {gradingSub?.id === s.id ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                  <label className="text-xs font-medium text-muted-foreground">Nota:</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={1}
                                    value={gradingSub.grade}
                                    onChange={(e) => setGradingSub({ ...gradingSub, grade: parseFloat(e.target.value) || 0 })}
                                    className="w-16 h-8 rounded border border-input bg-card px-2 text-sm text-center"
                                  />
                                  <span className="text-xs text-muted-foreground">/10</span>
                                </div>
                                <input
                                  type="text"
                                  value={gradingSub.feedback}
                                  onChange={(e) => setGradingSub({ ...gradingSub, feedback: e.target.value })}
                                  placeholder="Feedback opcional..."
                                  className="w-full h-8 rounded border border-input bg-card px-2 text-xs"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleGrade(s.id, null, gradingSub.grade, gradingSub.feedback)}
                                    className="h-7 text-xs"
                                  >
                                    Guardar nota
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setGradingSub(null)} className="h-7 text-xs">
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {s.grade !== null && s.grade !== undefined ? (
                                    <>
                                      <Badge variant={s.grade >= 7 ? "default" : "destructive"}>
                                        Nota: {s.grade}/10
                                      </Badge>
                                      {s.feedback && <span className="text-xs text-muted-foreground">{s.feedback}</span>}
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Sin calificar</span>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setGradingSub({
                                    id: s.id,
                                    grade: s.grade ?? 0,
                                    feedback: s.feedback || "",
                                  })}
                                >
                                  {s.grade !== null && s.grade !== undefined ? "Cambiar nota" : "Calificar"}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {notSubmitted.length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    No entregados ({notSubmitted.length})
                  </p>
                  {notSubmitted.map((ns) => (
                    <div key={ns.studentId} className="flex flex-col rounded-lg border bg-card p-3 gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${ns.expired ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                            {ns.expired ? "❌" : "⏳"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{ns.studentName}</p>
                            <p className="text-xs text-muted-foreground">{ns.studentCedula}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ns.expired ? (
                            <Badge variant="destructive" className="text-[10px]">Plazo vencido</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Pendiente</Badge>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            disabled={absentLoading === ns.studentId}
                            onClick={() => handleMarkAbsent(ns.studentId)}>
                            {absentLoading === ns.studentId ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                            No entrego (0)
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => setGradingSub({ studentId: ns.studentId, grade: 0, feedback: "" })}>
                            Calificar
                          </Button>
                        </div>
                      </div>

                      {gradingSub?.studentId === ns.studentId && (
                        <div className="border-t pt-3 flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-medium text-muted-foreground">Nota manual:</label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={1}
                              value={gradingSub.grade}
                              onChange={(e) => setGradingSub({ ...gradingSub, grade: parseFloat(e.target.value) || 0 })}
                              className="w-16 h-8 rounded border border-input bg-card px-2 text-sm text-center"
                            />
                            <span className="text-xs text-muted-foreground">/10</span>
                          </div>
                          <input
                            type="text"
                            value={gradingSub.feedback}
                            onChange={(e) => setGradingSub({ ...gradingSub, feedback: e.target.value })}
                            placeholder="Feedback o justificación..."
                            className="w-full h-8 rounded border border-input bg-card px-2 text-xs"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleGrade(null, ns.studentId, gradingSub.grade, gradingSub.feedback)}
                              className="h-7 text-xs"
                            >
                              Guardar nota
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setGradingSub(null)} className="h-7 text-xs">
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Tareas asignadas</h2>
            {!showForm && (
              <Button onClick={() => { setShowForm(true); setEditId(null); setTitle(""); setDescription(""); setDueDate(""); setQuestions([]); setCursoId(null); setSubjectId(subjectsList[0]?.id ?? null); setErrorMsg(""); }} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Nueva Tarea
              </Button>
            )}
          </div>

          {showForm && (
            <Card className="shadow-sm animate-scale-in">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{editId ? "Editar tarea" : "Crear nueva tarea"}
                    {activePeriod && (
                      <Badge variant="outline" className="ml-2 text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        📅 {activePeriod}
                      </Badge>
                    )}
                  </CardTitle>
                  <Button variant="ghost" size="icon-sm" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {cursosList.length > 0 && (
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-1.5 block">Curso</label>
                      <select
                        value={cursoId || ""}
                        onChange={(e) => setCursoId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm"
                      >
                        <option value="">Sin curso (todos los estudiantes)</option>
                        {cursosList.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre} ({c.nivel})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block">Materia</label>
                    <select value={subjectId ?? ""} onChange={(e) => setSubjectId(Number(e.target.value))}
                      className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm">
                      {filteredSubjects.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                      {filteredSubjects.length === 0 && (
                        <option value="" disabled>Selecciona primero un curso</option>
                      )}
                    </select>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className={editId ? "sm:col-span-2" : ""}>
                      <label className="text-sm font-semibold text-foreground mb-1.5 block">Titulo</label>
                      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Examen del primer parcial"
                        className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-1.5 block">Fecha y hora de cierre</label>
                      <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                        className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-1.5 block">Trimestre</label>
                      <select value={trimester} onChange={(e) => setTrimester(Number(e.target.value))}
                        className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm">
                        <option value={1}>Trimestre 1</option>
                        <option value={2}>Trimestre 2</option>
                        <option value={3}>Trimestre 3</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-1.5 block">Puntaje maximo</label>
                      <input type="number" value={puntos} min={1} onChange={(e) => setPuntos(Math.max(1, parseInt(e.target.value) || 10))}
                        className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Cuanto vale esta tarea sobre el total</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block">Descripcion / Instrucciones</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Instrucciones generales..."
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm min-h-[80px] resize-y" required />
                  </div>

                  {showAiPanel && (
                    <div className="rounded-xl border-2 border-violet-200 bg-violet-50/30 p-4 space-y-3 animate-scale-in">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-violet-700 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" /> Generar tarea con IA
                        </h4>
                        <button
                          type="button"
                          onClick={() => { setShowAiPanel(false); setAiError(""); }}
                          className="text-violet-400 hover:text-violet-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-violet-600">
                        La IA generara titulo, descripcion y preguntas en base a un tema. Podras editar todo antes de publicar.
                      </p>
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1 block">
                          Tema de la tarea
                        </label>
                        <input
                          type="text"
                          value={aiTopic}
                          onChange={(e) => setAiTopic(e.target.value)}
                          placeholder={`Ej: Suma de fracciones, Leyes de Newton, Simple Past...`}
                          className="w-full h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm"
                          onKeyDown={(e) => { if (e.key === "Enter" && !aiGenerating) handleAiGenerate(); }}
                          disabled={aiGenerating}
                        />
                      </div>
                      <div className="flex gap-4 items-end">
                        <div>
                          <label className="text-xs font-semibold text-foreground mb-1 block">
                            Cantidad de preguntas
                          </label>
                          <select
                            value={aiQuestionCount}
                            onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                            className="h-10 rounded-lg border border-violet-200 bg-white px-3 text-sm"
                            disabled={aiGenerating}
                          >
                            {[3, 4, 5, 6, 8, 10].map(n => (
                              <option key={n} value={n}>{n} preguntas</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          type="button"
                          onClick={handleAiGenerate}
                          disabled={aiGenerating || !aiTopic.trim() || !subjectId}
                          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white h-10"
                        >
                          {aiGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {aiGenerating ? "Generando..." : "Generar"}
                        </Button>
                      </div>
                      {aiError && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                          {aiError}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <ListChecks className="h-4 w-4" />
                        Preguntas ({questions.length})
                      </h3>
                      <div className="flex gap-2">
                        {!showAiPanel && (
                          <Button type="button" variant="outline" size="sm" onClick={() => { setShowAiPanel(true); setAiError(""); if (!aiTopic && title) setAiTopic(title); }} className="gap-1 text-xs h-8 border-violet-200 text-violet-600 hover:bg-violet-50">
                            <Sparkles className="h-3 w-3" /> IA
                          </Button>
                        )}
                        <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("mcq")} className="gap-1 text-xs h-8">
                          <Pencil className="h-3 w-3" /> + Opcion multiple
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("file_upload")} className="gap-1 text-xs h-8">
                          <FileUp className="h-3 w-3" /> + Subir archivo
                        </Button>
                      </div>
                    </div>

                    {questions.length === 0 && (
                      <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-6 text-center">
                        <ListChecks className="mx-auto h-6 w-6 text-muted-foreground/30" />
                        <p className="mt-2 text-sm text-muted-foreground">Sin preguntas. Agrega opcion multiple o de subir archivo.</p>
                      </div>
                    )}

                    {questions.map((q, qi) => (
                      <div key={q.id} className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full h-6 w-6 flex items-center justify-center">{qi + 1}</span>
                          <Badge variant={q.type === "mcq" ? "default" : "secondary"} className="text-[10px]">
                            {q.type === "mcq" ? "Opcion multiple" : "Subir archivo"}
                          </Badge>
                          <input type="number" value={q.points} min={1} max={20} onChange={(e) => updateQuestion(q.id, "points", parseInt(e.target.value) || 1)}
                            className="ml-auto w-14 h-7 text-xs text-center rounded border border-input bg-card" title="Puntos" />
                          <span className="text-[10px] text-muted-foreground">pts</span>
                          <button type="button" onClick={() => removeQuestion(q.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <input type="text" value={q.question} onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                          placeholder={q.type === "mcq" ? "Escribe la pregunta..." : "Describe que debe subir el estudiante..."}
                          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm" />
                        {q.type === "mcq" && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-medium text-muted-foreground">Opciones (marca la correcta)</p>
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input type="radio" name={`correct_${q.id}`} checked={q.correctIndex === oi} onChange={() => updateQuestion(q.id, "correctIndex", oi)} className="h-4 w-4 text-primary" />
                                <span className="text-[11px] font-medium text-muted-foreground w-5">{String.fromCharCode(65 + oi)}</span>
                                <input type="text" value={opt} onChange={(e) => updateOption(q.id, oi, e.target.value)}
                                  placeholder={`Opcion ${String.fromCharCode(65 + oi)}`}
                                  className="flex-1 h-9 rounded-lg border border-input bg-card px-3 text-xs" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={saving || !title.trim() || !description.trim()} className="gap-2">
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      {saving ? "Guardando..." : editId ? "Actualizar Tarea" : "Crear Tarea"}
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : assignments.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-12 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-4 font-medium text-muted-foreground">No hay tareas creadas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {assignments.map((a) => (
                <Card key={a.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 cursor-pointer" onClick={() => viewSubmissions(a.id)}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{a.subjectEmoji}</span>
                          <Badge variant="secondary" className="text-[10px]">{a.subjectName}</Badge>
                          {a.cursoNombre && (
                            <Badge variant="outline" className="text-[10px]">{a.cursoNombre}</Badge>
                          )}
                          {a.periodoNombre && (
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{a.periodoNombre}</Badge>
                          )}
                        </div>
                        <h3 className="font-bold text-foreground">{a.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0 items-center">
                        <a href={`/api/assignments/${a.id}/export`} download
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors" title="Exportar a Word/Impresión"
                          onClick={(e) => e.stopPropagation()}>
                          <Download className="h-4 w-4" />
                        </a>
                        <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); startEdit(a); }}
                          className="h-7 w-7 text-muted-foreground hover:text-primary" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(a.id); }}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground cursor-pointer" onClick={() => viewSubmissions(a.id)}>
                      {a.dueDate && <DueTimer dueDate={a.dueDate} compact />}
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{a.submissionCount ?? 0} entregas</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
