"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Send, X, Loader2, Sparkles, Paperclip, Mic, FileText, Check, ArrowLeft, Wrench } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/fetch-utils";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/~~(.+?)~~/g, "$1")
    .trim();
}

type FlowType = "none" | "create-assignment" | "my-courses" | "risk" | "message" | "tutor";

interface Course {
  id: number;
  nombre: string;
  nivel: string;
  studentCount: number;
  mySubjects: { subjectId: number; subjectName: string; subjectEmoji: string }[];
}

interface RiskStudent {
  id: number;
  fullName: string;
  cedula: string;
  consecutiveFailures: number;
  daysInactive: number;
  subjectName: string;
}

interface GeneratedQuestion {
  type: "mcq";
  question: string;
  options: string[];
  correctIndex: number;
  points: number;
}

interface GeneratedData {
  title: string;
  description: string;
  questions: GeneratedQuestion[];
}

export function AiAssistant({ showFab = true }: { showFab?: boolean }) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  const [flow, setFlow] = useState<FlowType>("none");
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/assistant",
    }),
  });

  const loading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleActionClick = useCallback((msg: string) => {
    if (sendingRef.current || loading) return;
    sendingRef.current = true;
    sendMessage({ text: msg }, { body: { flow } });
    setTimeout(() => { sendingRef.current = false; }, 500);
  }, [sendMessage, loading, flow]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setAttachedFile({ name: file.name, content });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) { setIsRecording(false); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Reconocimiento de voz no soportado."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      setInputText((prev) => prev ? `${prev} ${event.results[0][0].transcript}` : event.results[0][0].transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  }, [isRecording]);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sendingRef.current || loading) return;
    let text = inputText.trim();
    if ((!text && !attachedFile)) return;
    if (attachedFile) text += `\n\n[Archivo Adjunto: ${attachedFile.name}]\n${attachedFile.content}`;
    sendingRef.current = true;
    sendMessage({ text: text || "Revisa el archivo adjunto y haz lo que te pido con él." }, { body: { flow } });
    setInputText("");
    setAttachedFile(null);
    setTimeout(() => { sendingRef.current = false; }, 500);
  }, [inputText, attachedFile, loading, sendMessage]);

  const clearFlow = useCallback(() => {
    setFlow("none");
    setFlowLoading(false);
    setFlowError(null);
  }, []);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<{ subjectId: number; subjectName: string } | null>(null);
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [trimester, setTrimester] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [myCoursesData, setMyCoursesData] = useState<Course[] | null>(null);
  const [riskData, setRiskData] = useState<RiskStudent[] | null>(null);
  const [messageCourse, setMessageCourse] = useState<Course | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, [flow, generatedData, myCoursesData, riskData, messageSent]);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const detail = e.detail || {};
      if (detail.flow === "tutor") {
        clearFlow();
        setFlow("tutor");
        setOpen(true);
        setMessages([]);
      }
    };
    window.addEventListener("open-ai-assistant", handler as EventListener);
    return () => window.removeEventListener("open-ai-assistant", handler as EventListener);
  }, [clearFlow, setMessages]);

  const lastMsgIsAi = messages.length > 0 && messages[messages.length - 1]?.role !== "user";

  const quickActions = [
    { label: "Crear tarea", icon: "📝", action: () => {
      clearFlow(); setFlow("create-assignment"); setCourses([]); setSelectedCourse(null); setSelectedSubject(null); setTopic(""); setQuestionCount(5); setTrimester(1); setDueDate(""); setGeneratedData(null); setCreatedId(null);
    }},
    { label: "Mis cursos", icon: "📋", action: async () => {
      clearFlow(); setFlow("my-courses"); setFlowLoading(true); setFlowError(null);
      try {
        const res = await apiFetch("/api/teacher/courses");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        setMyCoursesData(data.cursos || []);
      } catch (e: any) {
        setFlowError(e.message || "Error al cargar cursos");
      } finally {
        setFlowLoading(false);
      }
    }},
    { label: "En riesgo", icon: "⚠️", action: async () => {
      clearFlow(); setFlow("risk"); setFlowLoading(true); setFlowError(null);
      try {
        const res = await apiFetch("/api/teacher/students?riesgo=true");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        setRiskData(data.estudiantes || []);
      } catch (e: any) {
        setFlowError(e.message || "Error al cargar estudiantes en riesgo");
      } finally {
        setFlowLoading(false);
      }
    }},
    { label: "Mensaje", icon: "📤", action: () => {
      clearFlow(); setFlow("message"); setMessageCourse(null); setMessageText(""); setMessageSent(false);
    }},
  ];

  const loadCourses = useCallback(async () => {
    setFlowLoading(true); setFlowError(null);
    try {
      const res = await apiFetch("/api/teacher/courses");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setCourses(data.cursos || []);
    } catch (e: any) {
      setFlowError(e.message || "Error al cargar cursos");
    } finally {
      setFlowLoading(false);
    }
  }, []);

  const handleGenerateAssignment = useCallback(async () => {
    if (!selectedSubject || !topic.trim()) return;
    setFlowLoading(true); setFlowError(null);
    try {
      const res = await apiFetch("/api/teacher/ai/generate-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: selectedSubject.subjectName, topic: topic.trim(), questionCount, trimester }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar");
      setGeneratedData(data.data);
    } catch (e: any) {
      setFlowError(e.message || "Error al generar tarea");
    } finally {
      setFlowLoading(false);
    }
  }, [selectedSubject, topic, questionCount, trimester]);

  const handleCreateAssignment = useCallback(async () => {
    if (!selectedCourse || !selectedSubject || !generatedData) return;
    setCreating(true); setFlowError(null);
    try {
      const res = await apiFetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId: selectedCourse.id,
          subjectId: selectedSubject.subjectId,
          title: generatedData.title,
          description: generatedData.description,
          trimester,
          puntos: 10,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          questions: generatedData.questions.map((q, i) => ({
            type: "mcq",
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            points: q.points,
            orderIndex: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear");
      setCreatedId(data.assignment?.id || data.id);
    } catch (e: any) {
      setFlowError(e.message || "Error al crear tarea");
    } finally {
      setCreating(false);
    }
  }, [selectedCourse, selectedSubject, generatedData, trimester, dueDate]);

  const handleSendMessage = useCallback(async () => {
    if (!messageCourse || !messageText.trim()) return;
    setFlowLoading(true); setFlowError(null);
    try {
      const res = await apiFetch("/api/messages/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId: messageCourse.id,
          message: messageText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar mensaje");
      setMessageSent(true);
    } catch (e: any) {
      setFlowError(e.message || "Error al enviar mensaje");
    } finally {
      setFlowLoading(false);
    }
  }, [messageCourse, messageText]);

  const renderCreateAssignmentFlow = () => {
    if (createdId) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-3">
            <Check className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-emerald-800 mb-1">Tarea creada exitosamente</p>
          <p className="text-xs text-muted-foreground mb-4">{generatedData?.title} • {selectedSubject?.subjectName}</p>
          <button onClick={clearFlow} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-700 transition-colors">
            Volver al chat
          </button>
        </div>
      );
    }

    if (generatedData) {
      return (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Previsualizar tarea</p>
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <p className="font-semibold text-sm">{generatedData.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-3">{generatedData.description}</p>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {generatedData.questions.map((q, i) => (
                <div key={i} className="rounded-lg bg-gray-50 p-2 text-xs">
                  <p className="font-medium">{i + 1}. {q.question}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.options.map((opt, j) => (
                      <span key={j} className={cn("rounded px-1.5 py-0.5 text-[10px]", j === q.correctIndex ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-muted-foreground")}>
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">{generatedData.questions.length} preguntas</p>
          </div>
          {flowError && <p className="text-xs text-red-600 text-center">{flowError}</p>}
          <div className="flex gap-2">
            <button onClick={() => setGeneratedData(null)} disabled={creating} className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-gray-50 transition-colors disabled:opacity-50">
              Editar
            </button>
            <button onClick={handleCreateAssignment} disabled={creating} className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              {creating ? "Creando..." : "Crear tarea"}
            </button>
          </div>
        </div>
      );
    }

    if (!selectedSubject) {
      if (!selectedCourse && courses.length === 0 && flowLoading) {
        return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>;
      }

      if (!selectedCourse) {
        if (courses.length === 0 && !flowLoading) {
          return (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-3">Selecciona un curso:</p>
              <button onClick={loadCourses} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-700 transition-colors">
                Cargar cursos
              </button>
              {flowError && <p className="text-xs text-red-600 mt-2">{flowError}</p>}
            </div>
          );
        }
        return (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Selecciona un curso:</p>
            <div className="space-y-1.5">
              {courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCourse(c); if (c.mySubjects.length > 0) setSelectedSubject(c.mySubjects[0]); }}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm hover:border-violet-300 hover:bg-violet-50 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-xs text-muted-foreground">{c.studentCount} estudiantes</span>
                </button>
              ))}
            </div>
            {flowError && <p className="text-xs text-red-600 mt-2">{flowError}</p>}
          </div>
        );
      }

      return (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => { setSelectedCourse(null); setCourses([]); loadCourses(); }} className="rounded-lg p-1 text-gray-400 hover:text-muted-foreground hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <p className="text-xs font-semibold text-muted-foreground">Materia para {selectedCourse.nombre}:</p>
          </div>
          <div className="space-y-1.5">
            {selectedCourse.mySubjects.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No tienes materias asignadas en este curso</p>
            ) : selectedCourse.mySubjects.map((s) => (
              <button
                key={s.subjectId}
                onClick={() => setSelectedSubject(s)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm hover:border-violet-300 hover:bg-violet-50 transition-colors flex items-center gap-2"
              >
                <span>{s.subjectEmoji || "📚"}</span>
                <span className="font-medium">{s.subjectName}</span>
              </button>
            ))}
          </div>
          {flowError && <p className="text-xs text-red-600 mt-2">{flowError}</p>}
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => { setSelectedSubject(null); }} className="rounded-lg p-1 text-gray-400 hover:text-muted-foreground hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-xs font-semibold text-muted-foreground">Detalles de la tarea</p>
        </div>
        <div className="space-y-2.5">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tema *</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: matrices 3x3, ecuaciones cuadraticas..."
              className="w-full h-9 rounded-xl border border-border bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Preguntas</label>
              <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full h-9 rounded-xl border border-border bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400">
                {[3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} preguntas</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Trimestre</label>
              <select value={trimester} onChange={(e) => setTrimester(Number(e.target.value))} className="w-full h-9 rounded-xl border border-border bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400">
                {[1, 2, 3].map(n => <option key={n} value={n}>Trimestre {n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha de entrega (opcional)</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 rounded-xl border border-border bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            />
          </div>
          {flowError && <p className="text-xs text-red-600">{flowError}</p>}
          <button
            onClick={handleGenerateAssignment}
            disabled={!topic.trim() || flowLoading}
            className="w-full rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
          >
            {flowLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {flowLoading ? "Generando..." : "Generar con IA"}
          </button>
        </div>
      </div>
    );
  };

  const renderFlowContent = () => {
    switch (flow) {
      case "create-assignment":
        return renderCreateAssignmentFlow();
      case "my-courses":
        return (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mis cursos</p>
            {flowLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>
            ) : myCoursesData && myCoursesData.length > 0 ? (
              <div className="space-y-2">
                {myCoursesData.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm">{c.nombre}</p>
                      <span className="text-xs text-muted-foreground">{c.studentCount} estudiantes</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {c.mySubjects.map((s) => (
                        <span key={s.subjectId} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700">
                          {s.subjectEmoji} {s.subjectName}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400">No tienes cursos asignados</p>
              </div>
            )}
            {flowError && <p className="text-xs text-red-600 text-center mt-2">{flowError}</p>}
            {myCoursesData && <button onClick={clearFlow} className="w-full mt-3 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-gray-50 transition-colors">Volver al chat</button>}
          </div>
        );
      case "risk":
        return (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Estudiantes en riesgo</p>
            {flowLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>
            ) : riskData && riskData.length > 0 ? (
              <div className="space-y-2">
                {riskData.map((s) => (
                  <div key={s.id} className="rounded-xl border border-red-100 bg-red-50 p-3">
                    <p className="font-semibold text-sm text-red-800">{s.fullName}</p>
                    <div className="flex gap-3 mt-1 text-xs text-red-600">
                      {s.consecutiveFailures >= 3 && <span>⚠️ {s.consecutiveFailures} fallos consecutivos</span>}
                      {s.daysInactive >= 7 && <span>📅 {s.daysInactive >= 999 ? "Sin entregas registradas" : `${s.daysInactive} días inactivo`}</span>}
                    </div>
                    <p className="text-[10px] text-red-400 mt-0.5">{s.subjectName}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-2">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-xs font-medium text-emerald-700">No hay estudiantes en riesgo</p>
                <p className="text-[10px] text-muted-foreground mt-1">Todos están al día</p>
              </div>
            )}
            {flowError && <p className="text-xs text-red-600 text-center mt-2">{flowError}</p>}
            {riskData && <button onClick={clearFlow} className="w-full mt-3 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-gray-50 transition-colors">Volver al chat</button>}
          </div>
        );
      case "message":
        return (
          <div>
            {messageSent ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-3">
                  <Check className="h-7 w-7 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-emerald-800 mb-1">Mensaje enviado</p>
                <p className="text-xs text-muted-foreground mb-3">A los estudiantes de {messageCourse?.nombre}</p>
                <button onClick={clearFlow} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-700 transition-colors">
                  Volver al chat
                </button>
              </div>
            ) : !messageCourse ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Selecciona el curso:</p>
                {courses.length === 0 && !flowLoading ? (
                  <button onClick={loadCourses} className="w-full rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors">
                    Cargar cursos
                  </button>
                ) : flowLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {courses.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setMessageCourse(c)}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm hover:border-violet-300 hover:bg-violet-50 transition-colors"
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                )}
                {flowError && <p className="text-xs text-red-600 mt-2">{flowError}</p>}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => { setMessageCourse(null); setMessageText(""); }} className="rounded-lg p-1 text-gray-400 hover:text-muted-foreground hover:bg-gray-100 transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <p className="text-xs font-semibold text-muted-foreground">Mensaje para {messageCourse.nombre}</p>
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  rows={4}
                  className="w-full rounded-xl border border-border bg-gray-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none"
                />
                {flowError && <p className="text-xs text-red-600 mt-1">{flowError}</p>}
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || flowLoading}
                  className="w-full mt-2 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                >
                  {flowLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {flowLoading ? "Enviando..." : "Enviar mensaje"}
                </button>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* ── FAB ── */}
      {showFab && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition-all hover:scale-105 active:scale-95"
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* ── Backdrop (mobile only) ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => { clearFlow(); setMessages([]); setOpen(false); }}
        />
      )}

      {/* ── Panel ── */}
      {open && (
        <div
          className={cn(
            // base
            "fixed z-50 flex flex-col bg-card shadow-2xl overflow-hidden",
            // mobile: full-width bottom sheet
            "inset-x-0 bottom-0 rounded-t-3xl",
            "h-[90dvh]",
            // desktop: floating card
            "sm:inset-x-auto sm:bottom-6 sm:right-6",
            "sm:w-[380px] sm:h-[560px]",
            "sm:rounded-2xl sm:border sm:border-violet-200",
            "animate-fade-in-up"
          )}
        >
          {/* Drag handle — mobile only */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0 bg-card rounded-t-3xl">
            <div className="w-10 h-1 rounded-full bg-accent" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between bg-violet-600 px-4 py-3 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              {flow !== "none" && flow !== "tutor" ? (
                <button
                  onClick={clearFlow}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/20 hover:bg-card/30 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card/20">
                  <Bot className="h-5 w-5" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold leading-none">Atlas IA</h3>
                <p className="text-[11px] text-violet-200 mt-0.5">
                  {flow === "create-assignment" ? "Crear tarea"
                    : flow === "my-courses" ? "Mis cursos"
                    : flow === "risk" ? "Estudiantes en riesgo"
                    : flow === "message" ? "Enviar mensaje"
                    : flow === "tutor" ? "Tutor de aprendizaje"
                    : "Asistente virtual"}
                </p>
              </div>
            </div>
            <button
              onClick={() => { clearFlow(); setMessages([]); setOpen(false); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-violet-200 hover:bg-card/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 min-h-0">
              <div ref={scrollRef} className="space-y-3 p-4">
                {flow !== "none" && flow !== "tutor" ? (
                  renderFlowContent()
                ) : messages.length === 0 ? (
                  flow === "tutor" ? (
                    <div className="flex flex-col items-center justify-center min-h-[260px] py-6">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 mb-4">
                        <Sparkles className="h-8 w-8 text-violet-600" />
                      </div>
                      <p className="text-base font-semibold text-foreground mb-1">Soy tu tutor de aprendizaje</p>
                      <p className="text-xs text-muted-foreground mb-6 text-center max-w-[280px] leading-relaxed">
                        No te daré respuestas directas. Te guiaré con preguntas y pistas para que descubras la solución tú mismo.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 max-w-[300px]">
                        {[
                          { label: "📐 Problema matemático", msg: "Necesito ayuda con un problema de matemáticas, guíame paso a paso sin darme la respuesta" },
                          { label: "📖 Explicar un tema", msg: "Explícame un tema académico, hazme preguntas para verificar mi comprensión" },
                          { label: "🔬 Ejercicio práctico", msg: "Propónme un ejercicio práctico y guíame para resolverlo" },
                          { label: "✏️ Revisar mi respuesta", msg: "Quiero que revises mi respuesta a un ejercicio, dime si voy bien sin corregirme directamente" },
                        ].map((btn, i) => (
                          <button
                            key={i}
                            onClick={() => handleActionClick(btn.msg)}
                            className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors flex items-center gap-1.5"
                          >
                            <span>{btn.msg}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[260px] py-6">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 mb-4">
                        <Sparkles className="h-8 w-8 text-violet-600" />
                      </div>
                      <p className="text-base font-semibold text-foreground mb-1">Hola, soy Atlas IA</p>
                      <p className="text-xs text-muted-foreground mb-6 text-center max-w-[260px]">
                        Puedo ayudarte a consultar datos de la plataforma o crear contenido educativo.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 max-w-[300px]">
                        {quickActions.map((btn, i) => (
                          <button
                            key={i}
                            onClick={btn.action}
                            className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors flex items-center gap-1.5"
                          >
                            <span>{btn.icon}</span>
                            <span>{btn.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )) : (
                  <>
                    {messages.map((m, i) => (
                      <div key={i}>
                        <div className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%]",
                            m.role === "user"
                              ? "bg-violet-600 text-white rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          )}>
                            {m.parts?.map((part: any, j: number) => {
                              if (part.type === "text") return <span key={j}>{stripMarkdown(part.text)}</span>;
                              if (part.type === "tool-call" || part.type === "tool-result") {
                                return (
                                  <div key={j} className={cn(
                                    "my-1.5 rounded-lg px-3 py-2 text-xs",
                                    part.type === "tool-result"
                                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border border-amber-200 bg-amber-50 text-amber-800"
                                  )}>
                                    <div className="flex items-center gap-1.5 font-medium">
                                      <Wrench className="h-3 w-3" />
                                      {part.type === "tool-result" ? "Consultado" : "Consultando"}: {part.toolName}
                                    </div>
                                    {part.type !== "tool-result" && (
                                      <div className="flex items-center gap-1 mt-1 text-amber-600">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Ejecutando...
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      </div>
                    ))}

                    {error && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 text-center">
                        Error de conexión. Intenta de nuevo.
                      </div>
                    )}

                    {loading && messages[messages.length - 1]?.role === "user" && (
                      <div className="flex gap-2 justify-start">
                        <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                          <div className="flex gap-1.5 items-center">
                            <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={endRef} />
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Quick action chips after AI response */}
            {flow === "none" && !loading && lastMsgIsAi && messages.length > 0 && (
              <div className="shrink-0 px-4 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {quickActions.map((btn, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={btn.action}
                      className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                      <span>{btn.icon}</span>
                      <span>{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Input bar ── */}
          <div
            className="border-t border-slate-100 bg-card shrink-0 px-3 pt-3 pb-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            {/* Attached file pill */}
            {attachedFile && (
              <div className="flex items-center justify-between rounded-xl bg-violet-50 border border-violet-100 px-3 py-2 text-xs mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-violet-600 shrink-0" />
                  <span className="truncate text-violet-800 font-medium">{attachedFile.name}</span>
                </div>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="ml-2 shrink-0 text-violet-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Row: [input………]  [send] */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="file"
                accept=".txt,.csv,.md"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />

              {/* Paperclip — desktop only */}
              {showFab && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-muted transition-colors"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              )}

              {/* Mic — desktop only */}
              {showFab && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={cn(
                    "hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    isRecording ? "bg-red-100 text-red-600 animate-pulse" : "text-slate-400 hover:bg-muted"
                  )}
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}

              {/* Text input — flex-1 takes remaining space */}
              <input
                name="message"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={flow === "tutor" ? "Escribe tu duda o tema..." : "Escribe un mensaje..."}
                className="flex-1 min-w-0 h-11 rounded-2xl border border-border bg-muted px-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors"
                disabled={loading}
                autoComplete="off"
              />

              {/* Send — always visible */}
              <button
                type="submit"
                disabled={loading || (!inputText.trim() && !attachedFile)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm hover:bg-violet-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </form>

            {/* Mobile-only: attach + mic as text links below the input */}
            {showFab && (
            <div className="sm:hidden flex items-center gap-4 mt-2 px-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-600 transition-colors"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span>Adjuntar</span>
              </button>
              <button
                type="button"
                onClick={toggleRecording}
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors",
                  isRecording ? "text-red-500 animate-pulse" : "text-slate-400 hover:text-violet-600"
                )}
              >
                <Mic className="h-3.5 w-3.5" />
                <span>{isRecording ? "Grabando..." : "Voz"}</span>
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
