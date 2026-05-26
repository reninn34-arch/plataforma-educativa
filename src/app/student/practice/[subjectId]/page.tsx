"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Pencil, Loader2, Sparkles } from "lucide-react";
import { SUBJECTS } from "@/lib/utils";
import { Countdown } from "@/components/practice/Countdown";
import { QuestionCard } from "@/components/practice/QuestionCard";
import { TimerRing } from "@/components/practice/TimerRing";
import { ResultsScreen } from "@/components/practice/ResultsScreen";
import { Hearts } from "@/components/practice/Hearts";

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

type GameState = "loading" | "ready" | "countdown" | "playing" | "results";

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.subjectId as string;
  const subject = SUBJECTS.find((s) => s.id === subjectId) ?? SUBJECTS[0];

  const [gameState, setGameState] = useState<GameState>("loading");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState(3);
  const [correctCount, setCorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; feedback: string } | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameOverRef = useRef(false);
  const answersLogRef = useRef<{ question: string; type: string; studentAnswer: string; isCorrect: boolean }[]>([]);
  const subjectIdx = SUBJECTS.findIndex((s) => s.id === subjectId);

  const currentExercise = exercises[currentIndex];

  // Fetch exercises
  const fetchExercises = useCallback(async () => {
    setGameState("loading");
    try {
      const res = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subjectId }),
      });
      const data = await res.json();
      if (data.exercises) {
        setExercises(data.exercises);
        setGameState("countdown");
      }
    } catch {
      setGameState("ready");
    }
  }, [subjectId]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

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

  // Save session to analytics when game ends
  useEffect(() => {
    if (gameState !== "results") return;
    const subjectIndex = SUBJECTS.findIndex((s) => s.id === subjectId) + 1;
    fetch("/api/practice/save-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId: subjectIndex,
        correctCount,
        totalCount: exercises.length,
        score: xpEarned,
        maxCombo,
        answers: answersLogRef.current,
      }),
    }).catch(() => {});
  }, [gameState]);
  useEffect(() => {
    if (timerSeconds === 0 && gameState === "playing" && !feedback && currentExercise?.timeLimit) {
      handleTimeout();
    }
  }, [timerSeconds]);

  const handleTimeout = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setLives((l) => {
      const newLives = l - 1;
      if (newLives <= 0) {
        gameOverRef.current = true;
      }
      return newLives;
    });
    setCombo(0);
    setFeedback({
      isCorrect: false,
      feedback: "Se acabo el tiempo. No te preocupes, en la siguiente pregunta lo haras mejor.",
    });
  };

  const handleAnswer = async (answer: string | number | boolean) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    let correctAnswer: string | number | boolean | string[] = "";
    if (currentExercise.type === "mcq") correctAnswer = currentExercise.correctIndex!;
    else if (currentExercise.type === "true_false") correctAnswer = currentExercise.correctAnswer!;
    else correctAnswer = currentExercise.acceptedAnswers!;

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
        setCombo((c) => {
          const newCombo = c + 1;
          setMaxCombo((m) => Math.max(m, newCombo));
          return newCombo;
        });
        setXpEarned((x) => x + 100 + (combo >= 2 ? combo * 25 : 0));
      } else {
        setCombo(0);
        setLives((l) => {
          const newLives = l - 1;
          if (newLives <= 0) {
            gameOverRef.current = true;
          }
          return newLives;
        });
      }

      answersLogRef.current.push({
        question: currentExercise.question,
        type: currentExercise.type,
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
    setTimerSeconds(0);

    if (gameOverRef.current || currentIndex >= exercises.length - 1) {
      // Final results
      const perfect = correctCount + (feedback?.isCorrect ? 0 : 0) >= exercises.length;
      setXpEarned((prev) => prev + (perfect ? 200 : 0));
      setGameState("results");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleRetry = () => {
    // Reset everything
    setCurrentIndex(0);
    setLives(3);
    setCorrectCount(0);
    setCombo(0);
    setMaxCombo(0);
    setFeedback(null);
    setXpEarned(0);
    setTimerSeconds(0);
    gameOverRef.current = false;
    fetchExercises();
  };

  const handleBackToStudy = () => {
    router.push(`/student/learn/${subjectId}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center justify-between px-4 max-w-2xl mx-auto w-full">
          <button onClick={() => router.push(`/student/learn/${subjectId}`)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Volver</span>
          </button>

          <div className="flex items-center gap-1">
            <span className="text-xl">{subject.emoji}</span>
            <span className="text-base font-bold text-foreground">{subject.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {gameState === "playing" && (
              <Hearts lives={lives} maxLives={3} />
            )}
            {gameState !== "loading" && gameState !== "playing" && (
              <span className="text-xs text-muted-foreground">Practica</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {/* LOADING */}
        {gameState === "loading" && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 animate-fade-in-up">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent shadow-sm">
                <Sparkles className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">Preparando tus ejercicios</p>
              <p className="text-sm text-muted-foreground mt-1">
                La IA esta generando preguntas de {subject.name}...
              </p>
            </div>
          </div>
        )}

        {/* COUNTDOWN */}
        {gameState === "countdown" && (
          <Countdown onDone={() => setGameState("playing")} />
        )}

        {/* PLAYING */}
        {gameState === "playing" && currentExercise && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Top bar: progress + timer + hearts */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${((currentIndex + (feedback ? 1 : 0)) / exercises.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {currentExercise.timeLimit && gameState === "playing" && !feedback && (
                  <TimerRing
                    key={currentIndex}
                    seconds={timerSeconds}
                    total={currentExercise.timeLimit}
                    onTimeout={handleTimeout}
                    paused={!!feedback}
                  />
                )}
                <Hearts lives={lives} maxLives={3} />
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
            onRetry={handleRetry}
            onBack={handleBackToStudy}
          />
        )}
      </main>
    </div>
  );
}
