"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, MessageCircle, X } from "lucide-react";
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
  embeddable?: boolean;
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const currentExercise = exercises[currentIndex];
  const timerSeconds = currentExercise?.timeLimit ? currentExercise.timeLimit - elapsedSeconds : 0;

  // Coach state
  const [showCoach, setShowCoach] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [retryGenerating, setRetryGenerating] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const [showModuleComplete, setShowModuleComplete] = useState(false);

  // Log game state changes for debugging
  useEffect(() => {
    console.log("[DEBUG] gameState:", gameState, "| lives:", lives, "| currentIndex:", currentIndex, "| correctCount:", correctCount, "| totalExercises:", exercises.length, "| gameOverRef:", gameOverRef.current, "| feedback:", !!feedback);
  }, [gameState, lives, currentIndex, correctCount, exercises.length, feedback]);

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
  const retryCountRef = useRef(0);

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

  // Oculta sidebar y sale de fullscreen
  useEffect(() => {
    const isPracticeActive = gameState === "countdown" || gameState === "playing" || gameState === "results";
    document.body.classList.toggle("practice-active", isPracticeActive);
    return () => {
      document.body.classList.remove("practice-active");
      document.exitFullscreen?.().catch(() => {});
    };
  }, [gameState]);

  const fetchExercises = useCallback(async (isRetry = false) => {
    setGameState("loading");
    console.log("[DEBUG] fetchExercises start | isRetry:", isRetry, "| nodeId:", nodeId, "| subject:", subjectSlug);
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
          retryCount: retryCountRef.current,
        }),
      });
      const data = await res.json();
      console.log("[DEBUG] fetchExercises response | status:", res.status, "| hasExercises:", !!data.exercises, "| hasLesson:", !!data.lesson, "| hasError:", !!data.error, "| isCached:", data.cached);
      if (data.exercises) {
        setExercises(data.exercises);
        if (isRetry) {
          setGameState("countdown");
        } else if (data.lesson) {
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

  const initialFetchRef = useRef(false);
  useEffect(() => {
    if (initialFetchRef.current) return;
    initialFetchRef.current = true;
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

  // Timer interval
  useEffect(() => {
    if (!currentExercise || gameState !== "playing" || feedback) return;
    const timeLimit = currentExercise.timeLimit;
    if (!timeLimit) return;

    setElapsedSeconds(0);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= timeLimit) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timeoutRef.current();
          return timeLimit;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [currentIndex, gameState, feedback, currentExercise]);

  const timeoutRef = useRef<() => void>(() => {});

  const triggerCoach = useCallback(async (question: string, studentAnswer: string, wasTimeout: boolean) => {
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
      setCoachMessage(data.coachMessage || "Sigue intentándolo, cada error es una oportunidad para aprender.");
    } catch {
      setCoachMessage("Cada intento te acerca más a dominar el tema. Sigue practicando.");
    } finally {
      setCoachLoading(false);
    }
  }, [aiPromptContext, nodeTitle]);

  const handleTimeout = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    console.log("[DEBUG] handleTimeout | question:", currentIndex, "| timerSeconds:", timerSeconds);
    setLives((l) => {
      const newLives = l - 1;
      if (newLives <= 0) { gameOverRef.current = true; console.log("[DEBUG] gameOverRef set to TRUE by timeout"); }
      return newLives;
    });
    setCombo(0);
    setFeedback({
      isCorrect: false,
      feedback: "Se acabó el tiempo. No te preocupes, en la siguiente pregunta lo harás mejor.",
    });
    triggerCoach(currentExercise.question, "", true);
  }, [currentIndex, timerSeconds, currentExercise, triggerCoach]);

  timeoutRef.current = handleTimeout;

  const handleAnswer = async (answer: string | number | boolean) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    console.log("[DEBUG] handleAnswer | question:", currentIndex, "| answerType:", typeof answer, "| answer:", answer);

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
        console.log("[DEBUG] answer CORRECT | newCombo:", newCombo, "| correctCount:", correctCount + 1);
      } else {
        setCombo(0);
        setLives((l) => {
          const newLives = l - 1;
          if (newLives <= 0) { gameOverRef.current = true; console.log("[DEBUG] gameOverRef set to TRUE by wrong answer"); }
          return newLives;
        });
        console.log("[DEBUG] answer INCORRECT | lives remaining:", lives - 1);
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
        feedback: "Error de conexión. Inténtalo de nuevo en la siguiente pregunta.",
      });
    }
  };

  const handleContinue = () => {
    console.log("[DEBUG] handleContinue | gameOverRef:", gameOverRef.current, "| currentIndex:", currentIndex, "| total:", exercises.length, "| correctCount:", correctCount, "| nextModuleFirstNodeId:", nextModuleFirstNodeId, "| showModuleComplete:", showModuleComplete);
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
    console.log("[DEBUG] handleRetry");
    document.documentElement.requestFullscreen?.().catch(() => {});
    setShowModuleComplete(false);
    setCurrentIndex(0);
    setLives(3);
    setCorrectCount(0);
    setCombo(0);
    setMaxCombo(0);
    setFeedback(null);
    setXpEarned(0);
    setElapsedSeconds(0);
    gameOverRef.current = false;
    sessionSavedRef.current = false;
    savePromiseRef.current = null;
    answersLogRef.current = [];
    retryCountRef.current += 1;
    setRetryGenerating(true);
    fetchExercises(true);
  };

  const handleStartPractice = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
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
    document.exitFullscreen?.().catch(() => {});
    if (savePromiseRef.current) {
      try { await savePromiseRef.current; } catch {}
    }
    router.push(`/student/path/${subjectSlug}`);
  };

  const handleNextNode = async () => {
    document.exitFullscreen?.().catch(() => {});
    if (savePromiseRef.current) {
      try { await savePromiseRef.current; } catch {}
    }
    if (nextNodeId) router.push(`/student/path/${subjectSlug}/${nextNodeId}`);
  };

  const handleNextModule = async () => {
    document.exitFullscreen?.().catch(() => {});
    if (savePromiseRef.current) {
      try { await savePromiseRef.current; } catch {}
    }
    if (nextModuleFirstNodeId) router.push(`/student/path/${subjectSlug}/${nextModuleFirstNodeId}`);
  };

  const isDarkState = gameState === "playing" || gameState === "countdown" || gameState === "results";

  return (
    <div className={cn(
      "flex min-h-screen flex-col min-w-0 overflow-x-hidden transition-colors duration-300",
      isDarkState ? "bg-[#1A0533]" : "bg-[#F8FAFC]"
    )}>
      {/* Header - adapts to Kahoot dark mode */}
      <header className={cn(
        "sticky top-0 z-20 transition-all duration-300",
        isDarkState
          ? "bg-[#1A0533]/95 backdrop-blur border-b border-white/10"
          : "bg-white/95 backdrop-blur shadow-sm border-b",
        !isDarkState && theme.border
      )}>
        <div className={cn(
          "flex h-14 items-center justify-between px-4 mx-auto w-full",
          isDarkState ? "max-w-none" : "max-w-2xl"
        )}>
          <button
            onClick={handleBackToStudy}
            className={cn(
              "flex items-center gap-2 transition-colors",
              isDarkState ? "text-white/50 hover:text-white" : "text-slate-500 hover:text-slate-800"
            )}
          >
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
        {/* Timer bar - Kahoot style horizontal bar during playing */}
        {gameState === "playing" && currentExercise && currentExercise.timeLimit && (
          <div className={cn(
            "px-4 pb-2 mx-auto w-full",
            isDarkState ? "max-w-none" : "max-w-2xl"
          )}>
            <TimerRing
              key={currentIndex}
              seconds={timerSeconds}
              total={currentExercise.timeLimit}
              onTimeout={handleTimeout}
              paused={!!feedback}
            />
          </div>
        )}
      </header>

      <main className={cn(
        "flex-1 px-4 py-2 sm:py-4 w-full min-w-0 relative",
        isDarkState ? "w-full" : "max-w-2xl mx-auto"
      )}>

        {/* LOADING */}
        {gameState === "loading" && (
          <div className="animate-fade-in-up space-y-6 py-8">
            <div className={cn("h-12 rounded-2xl bg-gradient-to-r animate-pulse", theme.header)} />
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
                  ? "La IA está generando nuevos ejercicios..."
                  : "La IA está diseñando tu camino..."
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

        {/* PLAYING - Kahoot style */}
        {gameState === "playing" && currentExercise && (
          <div className="animate-fade-in-up relative">
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {exercises.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === currentIndex
                      ? "w-8 bg-white"
                      : i < currentIndex
                      ? "w-2 bg-green-400"
                      : "w-2 bg-white/20"
                  )}
                />
              ))}
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

            {/* Coach Tooltip - Kahoot style */}
            {showCoach && (
              <div className="mt-2 sm:mt-3 animate-fade-in-up z-50 flex justify-center">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 sm:p-4 flex gap-3 relative max-w-md w-full">
                  <button onClick={() => setShowCoach(false)} className="absolute top-2 right-2 text-white/40 hover:text-white/80">
                    <X size={16} />
                  </button>
                  <div className="h-10 w-10 bg-white/15 text-white rounded-full flex items-center justify-center shrink-0">
                    {coachLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <MessageCircle size={18} />
                    )}
                  </div>
                  <div className="flex-1 pr-6">
                    <h4 className="text-sm font-bold text-white/90">Coach IA</h4>
                    <p className="text-xs sm:text-sm text-white/60 mt-0.5 leading-snug" dangerouslySetInnerHTML={{ __html: formatNotation(coachMessage) }} />
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
            onRetry={handleRetry}
            onBack={handleBackToStudy}
          />
        )}

        {/* Red flash overlay */}
        {flashRed && <div className="fixed inset-0 z-50 animate-flash-red pointer-events-none" />}
      </main>
    </div>
  );
}
