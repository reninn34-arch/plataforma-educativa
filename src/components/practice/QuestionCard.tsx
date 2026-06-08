"use client";

import { useState, useEffect } from "react";
import { cn, formatNotation } from "@/lib/utils";
import { Check, X, ArrowRight, Lightbulb } from "lucide-react";
import { sounds } from "@/lib/sounds";

const KAHOOT_COLORS = ["#E21B3C", "#1368CE", "#D89E00", "#26890C"];
const KAHOOT_COLORS_HOVER = ["#C41A33", "#1058B0", "#C08A00", "#1F7A0A"];

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
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setSelected(null);
    setTextAnswer("");
    setBoolAnswer(null);
    setAnswered(false);
    setEntered(false);
  }, [exercise.id]);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (answered && feedback) {
      if (feedback.isCorrect) sounds.correct();
      else sounds.incorrect();
    }
  }, [answered, feedback]);

  const handleSubmit = (answer: string | number | boolean) => {
    if (answered) return;
    setAnswered(true);
    onAnswer(answer);
  };

  const handleMCQSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
    handleSubmit(i);
  };

  const handleTFSelect = (val: boolean) => {
    if (answered) return;
    setBoolAnswer(val);
    handleSubmit(val);
  };

  const handleTextSubmit = () => {
    if (!textAnswer.trim() || answered) return;
    handleSubmit(textAnswer.trim());
  };

  const getCorrectAnswer = () => {
    if (exercise.type === "mcq") return exercise.correctIndex;
    if (exercise.type === "true_false") return exercise.correctAnswer;
    return exercise.acceptedAnswers?.[0] || "";
  };

  const isCorrect = feedback?.isCorrect ?? false;
  const showCorrectMCQ = answered && exercise.type === "mcq";

  return (
    <div className="flex flex-col min-h-[70dvh]">
      {/* Top bar: Question number + difficulty */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-white/60 text-sm font-bold tracking-wider uppercase">
          Pregunta {questionNumber}/{totalQuestions}
        </div>
        {exercise.difficulty === "hard" && (
          <span className="rounded-full bg-white/15 text-white/80 px-3 py-1 text-[10px] font-bold border border-white/20">
            SIN TIEMPO
          </span>
        )}
      </div>

      {/* Question */}
      <div className="flex-1 flex items-center justify-center mb-6">
        <h2
          className="text-white text-xl sm:text-2xl font-extrabold text-center leading-snug max-w-2xl"
          dangerouslySetInnerHTML={{ __html: formatNotation(exercise.question) }}
        />
      </div>

      {/* Answers */}
      <div className="space-y-2 w-full max-w-2xl mx-auto">
        {/* MCQ Options - Kahoot style colored rectangles */}
        {exercise.type === "mcq" && exercise.options && (
          <div className="space-y-2">
            {exercise.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrectOpt = i === exercise.correctIndex;
              let bgColor = KAHOOT_COLORS[i];
              let hoverColor = KAHOOT_COLORS_HOVER[i];
              let classes = "";
              let disabled = false;

              if (answered) {
                disabled = true;
                if (isCorrectOpt) {
                  bgColor = "#22C55E";
                  hoverColor = "#22C55E";
                  classes = "ring-2 ring-white/50 shadow-[0_0_20px_rgba(34,197,94,0.5)] scale-[1.02]";
                } else if (isSelected && !isCorrectOpt) {
                  bgColor = "#DC2626";
                  hoverColor = "#DC2626";
                  classes = "opacity-50 scale-95";
                } else {
                  classes = "opacity-30";
                }
              } else if (isSelected) {
                classes = "scale-[0.97] brightness-90";
              }

              const letter = String.fromCharCode(65 + i);

              return (
                <button
                  key={i}
                  disabled={disabled}
                  onClick={() => handleMCQSelect(i)}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-2xl p-3 sm:p-4 text-left transition-all duration-200",
                    "animate-kahoot-slide-up",
                    classes
                  )}
                  style={{
                    backgroundColor: bgColor,
                    animationDelay: `${i * 100}ms`,
                  }}
                  onMouseEnter={(e) => {
                    if (!answered && !disabled) {
                      e.currentTarget.style.backgroundColor = KAHOOT_COLORS_HOVER[i];
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!answered && !disabled) {
                      e.currentTarget.style.backgroundColor = KAHOOT_COLORS[i];
                    }
                  }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/20 text-white text-sm font-black">
                    {answered && isCorrectOpt ? (
                      <Check className="h-4 w-4" />
                    ) : answered && isSelected && !isCorrectOpt ? (
                      <X className="h-4 w-4" />
                    ) : (
                      letter
                    )}
                  </span>
                  <span className="text-white text-sm sm:text-base font-bold" dangerouslySetInnerHTML={{ __html: formatNotation(opt) }} />
                </button>
              );
            })}
          </div>
        )}

        {/* True/False - Kahoot style */}
        {exercise.type === "true_false" && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { val: true, label: "Verdadero", color: "#22C55E" },
              { val: false, label: "Falso", color: "#E21B3C" },
            ].map(({ val, label, color }) => {
              const isSelected = boolAnswer === val;
              const isCorrectAns = val === exercise.correctAnswer;
              let bg = color;
              let classes = "";

              if (answered) {
                if (isCorrectAns) {
                  classes = "ring-2 ring-white/50 shadow-[0_0_20px_rgba(34,197,94,0.5)]";
                } else if (isSelected && !isCorrectAns) {
                  bg = "#DC2626";
                  classes = "opacity-50";
                } else {
                  classes = "opacity-30";
                }
              } else if (isSelected) {
                classes = "scale-[0.95] brightness-90";
              }

              return (
                <button
                  key={String(val)}
                  disabled={answered}
                  onClick={() => handleTFSelect(val)}
                  className={cn(
                    "rounded-2xl p-4 sm:p-5 text-center text-lg sm:text-xl font-black text-white transition-all duration-200 animate-kahoot-slide-up",
                    classes
                  )}
                  style={{ backgroundColor: bg, animationDelay: val ? "0ms" : "100ms" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill in the blank */}
        {exercise.type === "fill_blank" && (
          <div className="space-y-4">
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={answered}
              onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
              placeholder="Escribe tu respuesta aqui..."
              className={cn(
                "w-full rounded-2xl border-2 px-5 py-4 text-base text-white placeholder:text-white/40 font-bold focus:outline-none transition-all duration-200",
                answered
                  ? isCorrect
                    ? "border-green-400 bg-green-500/20"
                    : "border-red-400 bg-red-500/20"
                  : "border-white/20 bg-white/10 focus:border-white/50 focus:bg-white/15"
              )}
              autoComplete="off"
              autoFocus
            />
            {!answered && (
              <button
                onClick={handleTextSubmit}
                disabled={!textAnswer.trim()}
                className="w-full rounded-2xl bg-white/15 text-white font-bold text-sm py-3 hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] border border-white/20"
              >
                Enviar respuesta
              </button>
            )}
            {answered && !isCorrect && (
              <p className="text-white/60 text-sm text-center">
                Respuesta esperada: <span className="font-bold text-white" dangerouslySetInnerHTML={{ __html: formatNotation(String(getCorrectAnswer())) }} />
              </p>
            )}
          </div>
        )}
      </div>

      {/* Feedback panel */}
      {answered && feedback && (
        <div className={cn(
          "mt-4 rounded-2xl p-4 space-y-3 animate-kahoot-feedback-slide border",
          isCorrect
            ? "bg-green-500/20 border-green-400/30"
            : "bg-red-500/20 border-red-400/30"
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              isCorrect ? "bg-green-500" : "bg-red-500"
            )}>
              {isCorrect ? <Check className="h-5 w-5 text-white" /> : <Lightbulb className="h-5 w-5 text-white" />}
            </div>
            <div>
              <p className={cn(
                "font-bold text-lg mb-1",
                isCorrect ? "text-green-400" : "text-red-400"
              )}>
                {isCorrect ? "Correcto!" : "Incorrecto"}
              </p>
              <p className="text-white/80 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatNotation(feedback.feedback) }} />
            </div>
          </div>

          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-white text-slate-900 py-3 text-sm font-black hover:bg-white/90 transition-all active:scale-[0.98]"
          >
            Continuar <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
