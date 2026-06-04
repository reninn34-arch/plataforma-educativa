"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Sparkles, MessageCircle, X } from "lucide-react";
import { Countdown } from "@/components/practice/Countdown";
import { QuestionCard } from "@/components/practice/QuestionCard";
import { TimerRing } from "@/components/practice/TimerRing";
import { Hearts } from "@/components/practice/Hearts";
import dynamic from "next/dynamic";

const ResultsScreen = dynamic(() => import("@/components/practice/ResultsScreen").then(m => ({ default: m.ResultsScreen })), { ssr: false });
const ModuleComplete = dynamic(() => import("@/components/practice/ModuleComplete").then(m => ({ default: m.ModuleComplete })), { ssr: false });
const LessonView = dynamic(() => import("@/components/practice/LessonView").then(m => ({ default: m.LessonView })), { ssr: false });
import { sounds } from "@/lib/sounds";
import { useRouter } from "next/navigation";
import { cn, formatNotation } from "@/lib/utils";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

interface Exercise {
  id: number;
  type: "mcq" | "fill_blank" | "true_false";
  question: string;
  options?: string[];
  correctIndex?: number;
  acceptedAnswers?: string[];
  correctAnswer?: string | boolean;
  timeLimit: number | null;
  difficulty: "easy" | "medium" | "hard";
}

interface ExampleStep {
  text: string;
  svg?: string;
}

interface VideoData {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
}

interface LessonData {
  title: string;
  explanation: string;
  example: {
    problem: string;
    steps: ExampleStep[];
    answer: string;
  };
  commonMistake: {
    description: string;
    correction: string;
  };
  diagram?: {
    mermaid?: string;
    svg?: string;
    caption: string;
  };
  quickCheck: {
    question: string;
    options: string[];
    correctIndex: number;
    feedback: string;
  };
  videos?: VideoData[];
  videoSearchUrl?: string;
}

type GameState = "loading" | "lesson" | "countdown" | "playing" | "results";

interface PracticeClientProps {
  subjectSlug: string;
  nodeId: number;
  nodeTitle: string;
  aiPromptContext: string | null;
  subjectId: number;
  nextNodeId: number | null;
  nextModuleFirstNodeId?: number | null;
  nextModuleTitle?: string | null;
}

export function PracticeClient({ subjectSlug, nodeId, nodeTitle, aiPromptContext, subjectId, nextNodeId, nextModuleFirstNodeId, nextModuleTitle }: PracticeClientProps) {
  const router = useRouter();
  const theme = subjectTheme(subjectSlug);

  const [gameState, setGameState] = useState<GameState>("loading");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [lesson, setLesson] = useState<LessonData | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [correctCount, setCorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; feedback: string } | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Coach state
  const [showCoach, setShowCoach] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [retryGenerating, setRetryGenerating] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const [showModuleComplete, setShowModuleComplete] = useState(false);

  useEffect(() => {
    if (flashRed) {
      const timer = setTimeout(() => setFlashRed(false), 600);
      return () => clearTimeout(timer);
    }
  }, [flashRed]);

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameOverRef = useRef(false);
  const answersLogRef = useRef<{ question: string; type: string; topic?: string; studentAnswer: string; isCorrect: boolean }[]>([]);
  const sessionSavedRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const prevLivesRef = useRef(lives);

  useEffect(() => {
    if (lives < prevLivesRef.current) {
      setFlashRed(true);
      sounds.heartbreak();
    }
    prevLivesRef.current = lives;
  }, [lives]);

  useEffect(() => {
    if (gameState === "playing" && timerSeconds > 0 && timerSeconds <= 5) {
      sounds.urgentTick();
    }
  }, [timerSeconds, gameState]);

  const currentExercise = exercises[currentIndex];

  const fetchExercises = useCallback(async (isRetry = false) => {
    setGameState("loading");
    try {
      const res = await apiFetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectSlug,
          nodeTitle,
          aiPromptContext: aiPromptContext || nodeTitle,
          nodeId,
          retry: isRetry,
        }),
      });
      const data = await res.json();
      if (data.exercises) {
        setExercises(data.exercises);
        if (data.lesson) {
          setLesson({ ...data.lesson, videos: data.videos || [], videoSearchUrl: data.videoSearchUrl });
          setGameState("lesson");
        } else if (data.concept_bites && data.concept_bites.length > 0) {
          setGameState("countdown");
        } else {
          setGameState("countdown");
        }
      } else if (data.error) {
        setFeedback({ isCorrect: false, feedback: data.error });
        setGameState("results");
      }
    } catch {
      setFeedback({ isCorrect: false, feedback: "Error al cargar ejercicios. Intenta de nuevo." });
      setGameState("results");
    } finally {
      setRetryGenerating(false);
    }
  }, [subjectSlug, aiPromptContext, nodeTitle, nodeId]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // Save session on results screen
  useEffect(() => {
    if (gameState === "results" && !sessionSavedRef.current) {
      sessionSavedRef.current = true;
      savePromiseRef.current = apiFetch("/api/practice/save-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          nodeId,
          correctCount,
          totalCount: exercises.length,
          score: xpEarned,
          maxCombo,
          answers: answersLogRef.current,
        }),
      })
        .then(async (r) => {
          const text = await r.text();
          console.log("[save-session client] status:", r.status, "headers:", Object.fromEntries(r.headers.entries()));
          console.log("[save-session client] raw body:", text);
          return JSON.parse(text);
        })
        .then((data) => { if (!data.saved) console.error("Save failed:", data); })
        .catch((err) => { console.error("Error saving session:", err); });
    }
  }, [gameState, subjectId, nodeId, correctCount, exercises.length, xpEarned, maxCombo]);

  // Timer logic
  useEffect(() => {
    if (!currentExercise || gameState !== "playing" || feedback) return;

    const timeLimit = currentExercise.timeLimit;
    if (!timeLimit) return;

    setTimerSeconds(timeLimit);

    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [currentIndex, gameState, feedback]);


  async function triggerCoach(question: string, studentAnswer: string, wasTimeout: boolean) {
    setShowCoach(true);
    setCoachLoading(true);
    setCoachMessage("Analizando tu respuesta...");

    try {
      const res = await apiFetch("/api/chat/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          studentAnswer: wasTimeout ? "" : studentAnswer,
          topic: aiPromptContext || nodeTitle,
          wasTimeout,
        }),
      });
      const data = await res.json();
      setCoachMessage(data.coachMessage || "Sigue intentandolo, cada error es una oportunidad para aprender.");
    } catch {
      setCoachMessage("Cada intento te acerca mas a dominar el tema. Sigue practicando.");
    } finally {
      setCoachLoading(false);
    }
  }

  function handleTimeout() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setLives((l) => {
      const newLives = l - 1;
      if (newLives <= 0) gameOverRef.current = true;
      return newLives;
    });
    setCombo(0);
    setFeedback({
      isCorrect: false,
      feedback: "Se acabo el tiempo. No te preocupes, en la siguiente pregunta lo haras mejor.",
    });
    triggerCoach(currentExercise.question, "", true);
  }

  const handleAnswer = async (answer: string | number | boolean) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    let correctAnswer: string | number | boolean | string[] = "";
    if (currentExercise.type === "mcq") correctAnswer = currentExercise.correctIndex ?? currentExercise.correctAnswer ?? 0;
    else if (currentExercise.type === "true_false") correctAnswer = currentExercise.correctAnswer!;
    else correctAnswer = (currentExercise.acceptedAnswers && currentExercise.acceptedAnswers.length > 0)
      ? currentExercise.acceptedAnswers
      : (currentExercise.correctAnswer ? [String(currentExercise.correctAnswer)] : []);

    try {
      const res = await apiFetch("/api/practice/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentExercise.question,
          type: currentExercise.type,
          studentAnswer: answer,
          correctAnswer,
          options: currentExercise.options,
        }),
      });
      const data = await res.json();

      if (data.isCorrect) {
        setCorrectCount((c) => c + 1);
        const newCombo = combo + 1;
        setCombo(newCombo);
        setMaxCombo((m) => Math.max(m, newCombo));
        setXpEarned((x) => x + 100 + (newCombo >= 2 ? newCombo * 25 : 0));
        setShowCoach(false);
      } else {
        setCombo(0);
        setLives((l) => {
          const newLives = l - 1;
          if (newLives <= 0) gameOverRef.current = true;
          return newLives;
        });
        triggerCoach(currentExercise.question, String(answer), false);
      }

      answersLogRef.current.push({
        question: currentExercise.question,
        type: currentExercise.type,
        topic: aiPromptContext || undefined,
        studentAnswer: String(answer),
        isCorrect: data.isCorrect,
      });

      setFeedback(data);
    } catch {
      setFeedback({
        isCorrect: false,
        feedback: "Error de conexion. Intentalo de nuevo en la siguiente pregunta.",
      });
    }
  };

  const handleContinue = () => {
    setFeedback(null);
    setShowCoach(false);

    if (gameOverRef.current || currentIndex >= exercises.length - 1) {
      const perfect = correctCount >= exercises.length;
      setXpEarned((prev) => prev + (perfect ? 200 : 0));

      if (nextModuleFirstNodeId && correctCount > 0 && !gameOverRef.current) {
        setShowModuleComplete(true);
      }
      setGameState("results");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setLives(3);
    setCorrectCount(0);
    setCombo(0);
    setMaxCombo(0);
    setFeedback(null);
    setXpEarned(0);
    setTimerSeconds(0);
    setLesson(null);
    gameOverRef.current = false;
    sessionSavedRef.current = false;
    savePromiseRef.current = null;
    answersLogRef.current = [];
    setRetryGenerating(true);
    fetchExercises(true);
  };

  const handleStartPractice = () => {
    setGameState("countdown");
  };

  const handleRegenerateDiagram = useCallback(async () => {
    try {
      const res = await apiFetch("/api/practice/diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectSlug,
          topicContext: aiPromptContext || nodeTitle,
          nodeId,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, [subjectSlug, aiPromptContext, nodeTitle, nodeId]);

  const handleBackToStudy = async () => {
    if (savePromiseRef.current) {
      try { await savePromiseRef.current; } catch {}
    }
    router.push(`/student/path/${subjectSlug}`);
  };

  const handleNextNode = async () => {
    if (savePromiseRef.current) {
      try { await savePromiseRef.current; } catch {}
    }
    if (nextNodeId) router.push(`/student/path/${subjectSlug}/${nextNodeId}`);
  };

  const handleNextModule = async () => {
    if (savePromiseRef.current) {
      try { await savePromiseRef.current; } catch {}
    }
    if (nextModuleFirstNodeId) router.push(`/student/path/${subjectSlug}/${nextModuleFirstNodeId}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] min-w-0 overflow-x-hidden">
      <header className={cn("sticky top-0 z-20 border-b bg-white/95 backdrop-blur shadow-sm", theme.border)}>
        <div className="flex h-14 items-center justify-between px-4 max-w-2xl mx-auto w-full">
          <button onClick={handleBackToStudy} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            {combo >= 2 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-100 to-amber-200 border border-amber-300 px-3 py-1 text-xs font-extrabold text-amber-700 shadow-sm animate-bounce-in">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-amber-500" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-.5-13v4h-5v2h5v4l5-5z"/></svg>
                Racha x{combo}
              </span>
            )}
            {gameState === "playing" && <Hearts lives={lives} maxLives={3} />}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full min-w-0 relative">

        {/* LOADING */}
        {gameState === "loading" && (
          <div className="animate-fade-in-up space-y-6 py-8">
            {/* Skeleton header */}
            <div className={cn("h-12 rounded-2xl bg-gradient-to-r animate-pulse", theme.header)} />
            {/* Skeleton step cards */}
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border bg-white p-5 shadow-sm space-y-3" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-200 animate-pulse" />
                  <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-slate-100 animate-pulse" />
                <div className="flex justify-center py-2">
                  <div className="h-24 w-52 rounded-lg bg-slate-100 animate-pulse" />
                </div>
              </div>
            ))}
            <div className="text-center pt-4">
              <p className="text-sm font-medium text-slate-500 animate-pulse">
                {retryGenerating
                  ? "La IA esta generando nuevos ejercicios..."
                  : "La IA esta diseniando tu camino..."
                }
              </p>
            </div>
          </div>
        )}

        {/* LESSON (Enriched teaching phase) */}
        {gameState === "lesson" && lesson && (
          <LessonView lesson={lesson} onStartPractice={handleStartPractice} subjectSlug={subjectSlug} onRegenerateDiagram={handleRegenerateDiagram} />
        )}

        {/* COUNTDOWN */}
        {gameState === "countdown" && (
          <Countdown onDone={() => setGameState("playing")} />
        )}

        {/* PLAYING */}
        {gameState === "playing" && currentExercise && (
          <div className="space-y-4 animate-fade-in-up relative">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", theme.progress)}
                    style={{ width: `${((currentIndex + (feedback ? 1 : 0)) / exercises.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {currentExercise.timeLimit && !feedback && (
                  <TimerRing
                    key={currentIndex}
                    seconds={timerSeconds}
                    total={currentExercise.timeLimit}
                    onTimeout={handleTimeout}
                    paused={!!feedback}
                  />
                )}
              </div>
            </div>

            <QuestionCard
              key={currentIndex}
              exercise={currentExercise}
              onAnswer={handleAnswer}
              feedback={feedback}
              onContinue={handleContinue}
              questionNumber={currentIndex + 1}
              totalQuestions={exercises.length}
            />

            {/* Coach Tooltip */}
            {showCoach && (
              <div className="mt-4 animate-fade-in-up z-50">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-lg flex gap-3 relative">
                  <button onClick={() => setShowCoach(false)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                  <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                    {coachLoading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <MessageCircle size={20} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Coach IA</h4>
                    <p className="text-sm text-blue-800 mt-0.5 leading-snug" dangerouslySetInnerHTML={{ __html: formatNotation(coachMessage) }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESULTS */}
        {gameState === "results" && !showModuleComplete && (
          <ResultsScreen
            correct={correctCount}
            total={exercises.length}
            xpEarned={xpEarned}
            maxCombo={maxCombo}
            wasPerfect={correctCount === exercises.length}
            starsEarned={exercises.length > 0 ? (correctCount === exercises.length ? 3 : correctCount >= exercises.length * 0.6 ? 2 : correctCount > 0 ? 1 : 0) : 0}
            onRetry={handleRetry}
            onBack={handleBackToStudy}
            hasNextNode={nextNodeId !== null}
            onNextNode={nextNodeId ? handleNextNode : undefined}
          />
        )}

        {/* MODULE COMPLETE */}
        {showModuleComplete && (
          <ModuleComplete
            correct={correctCount}
            total={exercises.length}
            xpEarned={xpEarned}
            maxCombo={maxCombo}
            moduleTitle={nextModuleTitle || ""}
            onNextModule={handleNextModule}
            onBack={handleBackToStudy}
          />
        )}

        {/* Red flash overlay */}
        {flashRed && <div className="fixed inset-0 z-50 animate-flash-red" />}
      </main>
    </div>
  );
}
