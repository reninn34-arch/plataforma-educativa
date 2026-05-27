"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, Sparkles, MessageCircle, X } from "lucide-react";
import { Countdown } from "@/components/practice/Countdown";
import { QuestionCard } from "@/components/practice/QuestionCard";
import { TimerRing } from "@/components/practice/TimerRing";
import { ResultsScreen } from "@/components/practice/ResultsScreen";
import { Hearts } from "@/components/practice/Hearts";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatNotation } from "@/lib/utils";

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

type GameState = "loading" | "concept" | "countdown" | "playing" | "results";

interface PracticeClientProps {
  subjectSlug: string;
  nodeId: number;
  nodeTitle: string;
  aiPromptContext: string | null;
  subjectId: number;
  nextNodeId: number | null;
}

export function PracticeClient({ subjectSlug, nodeId, nodeTitle, aiPromptContext, subjectId, nextNodeId }: PracticeClientProps) {
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState>("loading");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [conceptBites, setConceptBites] = useState<string[]>([]);
  const [currentConceptIndex, setCurrentConceptIndex] = useState(0);

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

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameOverRef = useRef(false);
  const answersLogRef = useRef<{ question: string; type: string; topic?: string; studentAnswer: string; isCorrect: boolean }[]>([]);
  const sessionSavedRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const currentExercise = exercises[currentIndex];

  const fetchExercises = useCallback(async (isRetry = false) => {
    setGameState("loading");
    try {
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectSlug,
          aiPromptContext: aiPromptContext || nodeTitle,
          nodeId,
          retry: isRetry,
        }),
      });
      const data = await res.json();
      if (data.exercises) {
        setExercises(data.exercises);
        if (data.concept_bites && data.concept_bites.length > 0) {
          setConceptBites(data.concept_bites);
          setGameState("concept");
        } else {
          setGameState("countdown");
        }
      } else if (data.error) {
        setFeedback({ isCorrect: false, feedback: data.error });
        setGameState("results");
      }
    } catch {
      // Error handled silently
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
      savePromiseRef.current = fetch("/api/practice/save-session", {
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
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [currentIndex, gameState, feedback]);

  useEffect(() => {
    if (timerSeconds === 0 && gameState === "playing" && !feedback && currentExercise?.timeLimit) {
      handleTimeout();
    }
  }, [timerSeconds]);

  const triggerCoach = async (question: string, studentAnswer: string, wasTimeout: boolean) => {
    setShowCoach(true);
    setCoachLoading(true);
    setCoachMessage("Analizando tu respuesta...");

    try {
      const res = await fetch("/api/chat/coach", {
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
  };

  const handleTimeout = () => {
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
  };

  const handleAnswer = async (answer: string | number | boolean) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    let correctAnswer: string | number | boolean | string[] = "";
    if (currentExercise.type === "mcq") correctAnswer = currentExercise.correctIndex ?? currentExercise.correctAnswer ?? 0;
    else if (currentExercise.type === "true_false") correctAnswer = currentExercise.correctAnswer!;
    else correctAnswer = (currentExercise.acceptedAnswers && currentExercise.acceptedAnswers.length > 0)
      ? currentExercise.acceptedAnswers
      : (currentExercise.correctAnswer ? [String(currentExercise.correctAnswer)] : []);

    try {
      const res = await fetch("/api/practice/check", {
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
        isCorrect: true,
        feedback: "Respuesta registrada. Continuemos.",
      });
    }
  };

  const handleContinue = () => {
    setFeedback(null);
    setShowCoach(false);

    if (gameOverRef.current || currentIndex >= exercises.length - 1) {
      const perfect = correctCount >= exercises.length;
      setXpEarned((prev) => prev + (perfect ? 200 : 0));
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
    gameOverRef.current = false;
    sessionSavedRef.current = false;
    savePromiseRef.current = null;
    answersLogRef.current = [];
    setRetryGenerating(true);
    fetchExercises(true);
  };

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

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center justify-between px-4 max-w-2xl mx-auto w-full">
          <button onClick={handleBackToStudy} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {gameState === "playing" && <Hearts lives={lives} maxLives={3} />}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full relative">

        {/* LOADING */}
        {gameState === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 animate-fade-in-up">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
                <Sparkles className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800">Preparando tu leccion</p>
              <p className="text-sm text-slate-500 mt-1">
                {retryGenerating ? "La IA esta generando nuevos ejercicios... puede tomar unos segundos." : "La IA esta diseniando tu camino..."}
              </p>
            </div>
          </div>
        )}

        {/* CONCEPT (Bite-sized lesson) */}
        {gameState === "concept" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-fade-in-up">
            <div className="bg-white border-2 border-slate-200 shadow-md rounded-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
              <h2 className="text-xs font-bold uppercase text-primary tracking-widest mb-6">Concepto Clave</h2>
              <p
                className="text-lg font-medium text-slate-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatNotation(conceptBites[currentConceptIndex]) }}
              />
            </div>
            <div className="flex gap-4 w-full max-w-md">
              <Button
                variant="outline"
                className="flex-1"
                disabled={currentConceptIndex === 0}
                onClick={() => setCurrentConceptIndex(i => i - 1)}
              >
                Anterior
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (currentConceptIndex === conceptBites.length - 1) {
                    setGameState("countdown");
                  } else {
                    setCurrentConceptIndex(i => i + 1);
                  }
                }}
              >
                {currentConceptIndex === conceptBites.length - 1 ? "A practicar!" : "Siguiente"}
              </Button>
            </div>
            <div className="flex gap-1.5 mt-4">
              {conceptBites.map((_, idx) => (
                <div key={idx} className={`h-2 w-2 rounded-full ${idx === currentConceptIndex ? 'bg-primary' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
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
                    className="h-full rounded-full bg-primary transition-all duration-500"
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
              <div className="absolute -bottom-16 left-0 right-0 animate-fade-in-up z-50">
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
        {gameState === "results" && (
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
      </main>
    </div>
  );
}
