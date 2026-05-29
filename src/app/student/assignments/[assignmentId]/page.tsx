"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Upload, FileText, CheckCircle, Loader2, Calendar, User, Download, AlertTriangle, ListChecks, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const hasMcq = questions.some(q => q.type === "mcq");
  const hasFile = questions.some(q => q.type === "file_upload") || questions.length === 0;
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
          // Restore MCQ answers
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

  const allMcqAnswered = questions
    .filter(q => q.type === "mcq")
    .every(q => mcqAnswers[q.id] !== undefined);

  const canSubmit = (hasFile ? !!file : true) && (hasMcq ? allMcqAnswered : true);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();

      if (file) {
        formData.append("file", file);
      }

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
      setError("Error de conexion");
    }
    setUploading(false);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!assignment) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <AlertTriangle className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-muted-foreground">Tarea no encontrada</p>
      <Button variant="outline" onClick={() => router.push("/student/dashboard")}>Volver al inicio</Button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4 max-w-3xl mx-auto w-full">
          <Button variant="ghost" size="icon" onClick={() => router.push("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xl">{assignment.subjectEmoji}</span>
            <div>
              <span className="text-base font-bold text-foreground">{assignment.subjectName}</span>
              <p className="text-xs text-muted-foreground">
                {assignment.dueDate 
                  ? `Entrega: ${new Date(assignment.dueDate).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })} a las ${new Date(assignment.dueDate).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`
                  : "Entrega de tarea"}
              </p>
            </div>
          </div>
          {isSubmitted && <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Entregado</Badge>}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full space-y-6 animate-fade-in-up">
        {/* Assignment Info */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{assignment.title}</CardTitle>
              {submission?.grade !== null && submission?.grade !== undefined && (
                <Badge variant={submission.grade >= 7 ? "default" : "destructive"}>Nota: {submission.grade}/10</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{assignment.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{assignment.teacherName}</span>
            </div>
            {assignment.dueDate && (
              <div className="flex items-center">
                <DueTimer dueDate={assignment.dueDate} />
              </div>
            )}
            {isExpired && !isSubmitted && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
                <AlertTriangle className="h-4 w-4" /> El plazo de entrega ha vencido. No puedes enviar esta tarea.
              </div>
            )}
          </CardContent>
        </Card>

        {/* MCQ Questions — only if not expired or already submitted */}
        {(!isExpired || isSubmitted) && hasMcq && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4" /> Preguntas ({questions.filter(q => q.type === "mcq").length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {questions.filter(q => q.type === "mcq").map((q) => (
                <div key={q.id} className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">
                    {q.question}
                    <span className="ml-2 text-[10px] text-muted-foreground font-normal">({q.points} pts)</span>
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
                            ? "border-primary bg-accent"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          mcqAnswers[q.id] === oi ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="font-medium text-foreground">{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* File Upload — only if not expired or already submitted */}
        {(!isExpired || isSubmitted) && hasFile && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileUp className="h-4 w-4" /> Subir archivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isSubmitted && submission?.fileUrl ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{submission.content}</p>
                    {submission.submittedAt && <p className="text-xs text-muted-foreground">Entregado: {new Date(submission.submittedAt).toLocaleString("es-EC")}</p>}
                  </div>
                  <a href={submission.fileUrl} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">
                    <Download className="h-3.5 w-3.5" /> Ver
                  </a>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                  className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                    dragOver ? "border-primary bg-accent scale-[1.02]" : file ? "border-emerald-300 bg-emerald-50/50" : "border-muted-foreground/20 hover:border-muted-foreground/40"
                  }`}
                >
                  {file ? (
                    <div className="space-y-2">
                      <FileText className="h-10 w-10 mx-auto text-primary" />
                      <div>
                        <p className="text-sm font-bold text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button onClick={() => setFile(null)} className="text-xs text-muted-foreground hover:text-destructive">Quitar</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground/30" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Arrastra tu archivo o{" "}
                          <label className="text-primary hover:underline cursor-pointer">
                            seleccionalo
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.zip"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                          </label>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">PDF, Word, imagenes, ZIP, TXT (max 10 MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
                </div>
              )}

              {!isSubmitted && !isExpired && (
                <Button onClick={handleSubmit} disabled={!canSubmit || uploading} size="xl" className="w-full gap-2 shadow-sm">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  {uploading ? "Entregando..." : "Entregar Tarea"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Re-submit option */}
        {isSubmitted && (
          <Card className="shadow-sm border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-bold">Tarea entregada</span>
                {submission?.grade !== null && submission?.grade !== undefined && (
                  <Badge variant={submission.grade >= 7 ? "default" : "destructive"} className="ml-auto">Nota: {submission.grade}/10</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setSubmission(null)}>Cambiar entrega</Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
