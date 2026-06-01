"use client";

import { useState, useEffect } from "react";
import { cn, formatNotation } from "@/lib/utils";
import { Check, X, ArrowRight, Lightbulb } from "lucide-react";
import { sounds } from "@/lib/sounds";

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

interface QuestionCardProps {
  exercise: Exercise;
  onAnswer: (answer: string | number | boolean) => void;
  feedback: { isCorrect: boolean; feedback: string } | null;
  onContinue: () => void;
  questionNumber: number;
  totalQuestions: number;
}

export function QuestionCard({
  exercise,
  onAnswer,
  feedback,
  onContinue,
  questionNumber,
  totalQuestions,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [boolAnswer, setBoolAnswer] = useState<boolean | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (answered && feedback) {
      if (feedback.isCorrect) sounds.correct();
      else sounds.incorrect();
    }
  }, [answered, feedback]);

  const handleSubmit = () => {
    if (exercise.type === "mcq" && selected !== null) {
      setAnswered(true);
      onAnswer(selected);
    } else if (exercise.type === "true_false" && boolAnswer !== null) {
      setAnswered(true);
      onAnswer(boolAnswer);
    } else if (exercise.type === "fill_blank" && textAnswer.trim()) {
      setAnswered(true);
      onAnswer(textAnswer.trim());
    }
  };

  const getCorrectAnswer = () => {
    if (exercise.type === "mcq") return exercise.correctIndex;
    if (exercise.type === "true_false") return exercise.correctAnswer;
    return exercise.acceptedAnswers?.[0] || "";
  };

  const feedbackColor = feedback?.isCorrect
    ? "border-emerald-500 bg-emerald-50"
    : "border-red-400 bg-red-50";

  return (
    <div className="animate-scale-in space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-primary">Pregunta {questionNumber} de {totalQuestions}</span>
        {exercise.difficulty === "hard" && (
          <span className="ml-auto rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-[10px] font-bold border border-purple-200">
            SIN TIEMPO
          </span>
        )}
      </div>

      {/* Question */}
      <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
        <h3
          className="text-lg font-bold text-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatNotation(exercise.question) }}
        />
      </div>

      {/* MCQ Options */}
      {exercise.type === "mcq" && exercise.options && (
        <div className="grid gap-2.5">
          {exercise.options.map((opt, i) => {
            let stateClass = "border-border bg-card hover:border-primary/50 hover:bg-accent/50";
            if (answered) {
              if (i === exercise.correctIndex) {
                stateClass = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20";
              } else if (i === selected && i !== exercise.correctIndex) {
                stateClass = "border-red-400 bg-red-50 ring-1 ring-red-400/20";
              } else {
                stateClass = "border-border/50 bg-muted/30 opacity-50";
              }
            } else if (i === selected) {
              stateClass = "border-primary bg-accent ring-1 ring-primary/20";
            }

            return (
              <button
                key={i}
                disabled={answered}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-xl border-2 p-3 sm:p-4 text-left transition-all duration-200 active:scale-[0.98] animate-fade-in-up",
                  stateClass
                )}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors",
                  answered && i === exercise.correctIndex
                    ? "bg-emerald-500 text-white"
                    : answered && i === selected
                    ? "bg-red-500 text-white"
                    : selected === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {answered && i === exercise.correctIndex ? <Check className="h-4 w-4" /> :
                   answered && i === selected ? <X className="h-4 w-4" /> :
                   String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm font-medium text-foreground" dangerouslySetInnerHTML={{ __html: formatNotation(opt) }} />
              </button>
            );
          })}
        </div>
      )}

      {/* True/False */}
      {exercise.type === "true_false" && (
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((val) => {
            let stateClass = "border-border bg-card hover:border-primary/50";
            if (answered) {
              if (val === exercise.correctAnswer) {
                stateClass = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20";
              } else if (val === boolAnswer && val !== exercise.correctAnswer) {
                stateClass = "border-red-400 bg-red-50 ring-1 ring-red-400/20";
              } else {
                stateClass = "border-border/50 bg-muted/30 opacity-50";
              }
            } else if (val === boolAnswer) {
              stateClass = "border-primary bg-accent ring-1 ring-primary/20";
            }

            return (
              <button
                key={String(val)}
                disabled={answered}
                onClick={() => setBoolAnswer(val)}
                className={cn(
                  "rounded-xl border-2 p-3 sm:p-5 text-center text-lg font-bold transition-all active:scale-95 animate-fade-in-up",
                  stateClass
                )}
                style={{ animationDelay: `${val ? 0 : 80}ms` }}
              >
                {val ? "Verdadero" : "Falso"}
              </button>
            );
          })}
        </div>
      )}

      {/* Fill in the blank */}
      {exercise.type === "fill_blank" && (
        <div className="space-y-3">
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={answered}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="Escribe tu respuesta aqui..."
            className={cn(
              "w-full rounded-xl border-2 bg-card px-5 py-4 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors",
              answered
                ? feedback?.isCorrect
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-red-400 bg-red-50"
                : "border-input focus:border-primary focus:ring-2 focus:ring-primary/20"
            )}
            autoComplete="off"
            autoFocus
          />
          {answered && (
            <p className="text-sm text-muted-foreground">
              Respuesta esperada: <span className="font-semibold text-foreground" dangerouslySetInnerHTML={{ __html: formatNotation(String(getCorrectAnswer())) }} />
            </p>
          )}
        </div>
      )}

      {/* Submit button (before answering) */}
      {!answered && (
        <button
          onClick={handleSubmit}
          disabled={
            (exercise.type === "mcq" && selected === null) ||
            (exercise.type === "true_false" && boolAnswer === null) ||
            (exercise.type === "fill_blank" && !textAnswer.trim())
          }
          className="w-full rounded-xl bg-primary py-3.5 sm:py-4 text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm"
        >
          Comprobar respuesta
        </button>
      )}

      {/* Feedback + Continue */}
      {answered && feedback && (
        <div className={cn("rounded-2xl border-2 p-4 sm:p-5 space-y-4 animate-scale-in", feedbackColor, !feedback.isCorrect && "animate-shake")}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              feedback.isCorrect ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
            )}>
              {feedback.isCorrect ? <Check className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
            </div>
            <p className="text-sm font-medium text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatNotation(feedback.feedback) }} />
          </div>

          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-3 sm:py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] shadow-sm"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
