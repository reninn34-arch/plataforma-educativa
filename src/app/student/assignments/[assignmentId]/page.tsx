"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Upload, FileText, CheckCircle, Loader2, User, Download, AlertTriangle, ListChecks, FileUp, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DueTimer } from "@/components/DueTimer";
import { apiFetch } from "@/lib/fetch-utils";

interface AssignmentDetail {
  id: number;
  title: string;
  description: string;
  dueDate: string | null;
  subjectName: string;
  subjectEmoji: string;
  subjectSlug: string;
  teacherName: string;
  fileUrl?: string | null;
}

interface QuestionItem {
  id: number;
  type: "mcq" | "file_upload";
  question: string;
  options?: string[];
  points: number;
  orderIndex: number;
}

interface Submission {
  id: number;
  status: string;
  fileUrl?: string;
  content?: string;
  submittedAt?: string;
  grade?: number;
  feedback?: string;
  answers?: { questionId: number; selectedIndex: number; isCorrect: boolean }[];
}

export default function AssignmentSubmitPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const mcqQuestions = questions.filter(q => q.type === "mcq");
  const fileQuestions = questions.filter(q => q.type === "file_upload");
  const hasMcq = mcqQuestions.length > 0;
  const hasFile = fileQuestions.length > 0 || questions.length === 0;
  const isSubmitted = submission?.status === "submitted" || submission?.status === "graded";
  const isExpired = assignment?.dueDate ? new Date(assignment.dueDate).getTime() < Date.now() : false;

  useEffect(() => {
    apiFetch(`/api/assignments/${assignmentId}`)
      .then(r => r.json())
      .then(d => {
        setAssignment(d.assignment);
        setQuestions(d.questions || []);
        if (d.submissions?.[0]) {
          setSubmission(d.submissions[0]);
          if (d.submissions[0].answers) {
            const restored: Record<number, number> = {};
            d.submissions[0].answers.forEach((a: { questionId: number; selectedIndex: number }) => {
              restored[a.questionId] = a.selectedIndex;
            });
            setMcqAnswers(restored);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [assignmentId]);

  const allMcqAnswered = mcqQuestions.every(q => mcqAnswers[q.id] !== undefined);
  const canSubmit = (hasFile ? !!file : true) && (hasMcq ? allMcqAnswered : true);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      if (hasMcq) {
        const answers = Object.entries(mcqAnswers).map(([qId, selected]) => ({
          questionId: parseInt(qId),
          selectedIndex: selected,
        }));
        formData.append("answers", JSON.stringify(answers));
      }

      const res = await apiFetch(`/api/assignments/${assignmentId}/submit`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al entregar");
        setUploading(false);
        return;
      }

      setSubmission({
        id: data.submissionId,
        status: "submitted",
        fileUrl: data.fileUrl,
        content: file?.name || "",
        submittedAt: new Date().toISOString(),
        grade: data.autoGrade,
      });
      setFile(null);
    } catch {
      setError("Error de conexión");
    }
    setUploading(false);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  if (!assignment) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-4">
      <AlertTriangle className="h-10 w-10 text-slate-300" />
      <p className="text-slate-500">Tarea no encontrada</p>
      <Button variant="outline" onClick={() => router.push("/student/dashboard")} className="rounded-xl border-slate-200">Volver al inicio</Button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Gradient Header */}
      <header className="sticky top-0 z-20 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg">
        <div className="flex h-14 items-center gap-3 px-4 max-w-3xl mx-auto w-full">
          <button onClick={() => router.push("/student/dashboard")} className="text-white/80 hover:bg-white/15 p-2 rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xl">{assignment.subjectEmoji}</span>
            <div>
              <span className="text-base font-bold text-white">{assignment.subjectName}</span>
              <p className="text-xs text-indigo-200">
                {assignment.dueDate 
                  ? `Entrega: ${new Date(assignment.dueDate).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })} a las ${new Date(assignment.dueDate).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`
                  : "Entrega de tarea"}
              </p>
            </div>
          </div>
          {isSubmitted && (
            <Badge className="bg-emerald-500 text-white border-none gap-1 rounded-lg">
              <CheckCircle className="h-3 w-3" /> Entregado
            </Badge>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-6 animate-fade-in-up">
        {/* Assignment Info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-800">{assignment.title}</h1>
            {submission?.grade !== null && submission?.grade !== undefined && (
              <Badge className={submission.grade >= 7 ? "bg-emerald-500 text-white border-none" : "bg-red-500 text-white border-none"}>
                Nota: {submission.grade}/10
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{assignment.description}</p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{assignment.teacherName}</span>
            {assignment.fileUrl && (
              <a href={assignment.fileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 hover:underline">
                <FileText className="h-3.5 w-3.5" /> Archivo adjunto
              </a>
            )}
          </div>
          {assignment.dueDate && <DueTimer dueDate={assignment.dueDate} />}
          {isExpired && !isSubmitted && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
              <AlertTriangle className="h-4 w-4" /> El plazo de entrega ha vencido. No puedes enviar esta tarea.
            </div>
          )}
        </div>

        {/* MCQ Questions */}
        {(!isExpired || isSubmitted) && hasMcq && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-indigo-500" /> Preguntas ({mcqQuestions.length})
            </h2>
            {mcqQuestions.map((q) => (
              <div key={q.id} className="space-y-3 pb-5 border-b border-slate-100 last:border-b-0 last:pb-0">
                <p className="text-sm font-semibold text-slate-700">
                  {q.question}
                  <span className="ml-2 text-[10px] text-slate-400 font-normal">({q.points} pts)</span>
                </p>
                <div className="grid gap-2">
                  {(q.options as string[]).map((opt, oi) => (
                    <button
                      key={oi}
                      disabled={isSubmitted}
                      onClick={() => setMcqAnswers(prev => ({ ...prev, [q.id]: oi }))}
                      className={`flex items-center gap-3 w-full rounded-xl border-2 p-3 text-left text-sm transition-all ${
                        isSubmitted
                          ? "opacity-60"
                          : mcqAnswers[q.id] === oi
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-indigo-200"
                      }`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        mcqAnswers[q.id] === oi ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="font-medium text-slate-700">{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* File Upload */}
        {(!isExpired || isSubmitted) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {(fileQuestions.length > 0 || questions.length === 0) && (
          <>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileUp className="h-4 w-4 text-indigo-500" /> Ejercicios de desarrollo ({fileQuestions.length})
            </h2>
            {fileQuestions.map((q) => (
              <div key={q.id} className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-sm font-semibold text-slate-700">
                  {q.question}
                  <span className="ml-2 text-[10px] text-slate-400 font-normal">({q.points} pts)</span>
                </p>
              </div>
            ))}
            
            {isSubmitted && submission?.fileUrl ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center">
                  <FileText className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{submission.content}</p>
                  {submission.submittedAt && <p className="text-xs text-slate-500">Entregado: {new Date(submission.submittedAt).toLocaleString("es-EC")}</p>}
                </div>
                <a href={submission.fileUrl} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm">
                  <Download className="h-3.5 w-3.5" /> Ver
                </a>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                  dragOver ? "border-indigo-400 bg-indigo-50 scale-[1.02]" : file ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 hover:border-indigo-200"
                }`}
              >
                {file ? (
                  <div className="space-y-2">
                    <FileText className="h-10 w-10 mx-auto text-indigo-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={() => setFile(null)} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Quitar</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-10 w-10 mx-auto text-slate-300" />
                    <div>
                      <p className="text-sm font-semibold text-slate-600">
                        Arrastra tu archivo o{" "}
                        <label className="text-indigo-600 hover:underline cursor-pointer">
                          selecciónalo
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.zip"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                        </label>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PDF, Word, imágenes, ZIP, TXT (max 10 MB)</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {!isSubmitted && !isExpired && (
              <Button onClick={handleSubmit} disabled={!canSubmit || uploading} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md shadow-indigo-200">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                {uploading ? "Entregando..." : "Entregar Tarea"}
              </Button>
            )}
          </div>
        )}

        {/* Submission confirmation */}
        {isSubmitted && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="font-bold">Tarea entregada</span>
              {submission?.grade !== null && submission?.grade !== undefined && (
                <Badge className={submission.grade >= 7 ? "bg-emerald-500 text-white border-none ml-auto" : "bg-red-500 text-white border-none ml-auto"}>
                  Nota: {submission.grade}/10
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setSubmission(null)} className="rounded-xl border-slate-200">Cambiar entrega</Button>
          </div>
        )}
      </main>
    </div>
  );
}
