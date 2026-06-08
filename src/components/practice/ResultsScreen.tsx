"use client";

import { useEffect, useState } from "react";
import { Trophy, Star, Flame, Target, RefreshCw, BookOpen, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { sounds } from "@/lib/sounds";

interface ResultsScreenProps {
  correct: number;
  total: number;
  xpEarned: number;
  maxCombo: number;
  wasPerfect: boolean;
  starsEarned: number;
  onRetry: () => void;
  onBack: () => void;
  onNextNode?: () => void;
  hasNextNode?: boolean;
}

function AnimatedScore({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const start = performance.now();
    const duration = 800 + value * 3;
    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [value]);

  return <>{display}</>;
}

export function ResultsScreen({
  correct,
  total,
  xpEarned,
  maxCombo,
  wasPerfect,
  starsEarned,
  onRetry,
  onBack,
  onNextNode,
  hasNextNode,
}: ResultsScreenProps) {
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const stars = starsEarned;

  useEffect(() => {
    if (wasPerfect) sounds.achievement();
  }, [wasPerfect]);

  useEffect(() => {
    if (starsEarned >= 2) {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#FFD700", "#FF6B6B", "#4ECDC4"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#FFD700", "#FF6B6B", "#4ECDC4"],
        });

        if (Date.now() < end) requestAnimationFrame(frame);
      };

      frame();
    }
  }, [starsEarned]);

  return (
    <div className="animate-scale-in space-y-8 max-w-md mx-auto w-full px-4 sm:px-0">
      {/* Trophy / Header */}
      <div className="flex flex-col items-center py-6">
        <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full mb-5 shadow-lg bg-gradient-to-br from-yellow-400 to-amber-500">
          <Trophy className="h-14 w-14 text-white animate-bounce-in" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-center text-white">
          {wasPerfect ? "PERFECTO!" : stars >= 2 ? "Buen trabajo!" : "Sigue intentando"}
        </h2>
        {starsEarned > 0 && (
          <p className="text-yellow-400/80 text-sm font-semibold mt-2">
            Ganaste {starsEarned} {starsEarned === 1 ? "estrella" : "estrellas"}
          </p>
        )}
      </div>

      {/* Stars */}
      <div className="flex items-center justify-center gap-3">
        {[1, 2, 3].map((s) => (
          <Star
            key={s}
            className={cn(
              "h-10 w-10 sm:h-12 sm:w-12 transition-all duration-500",
              s <= stars
                ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.4)]"
                : "text-white/10"
            )}
          />
        ))}
      </div>

      {/* Score card */}
      <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-white/50 text-sm font-medium">Respuestas correctas</span>
          <span className="text-white text-xl font-black tabular-nums">
            {correct}/{total}
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              percentage >= 80 ? "bg-green-400" : percentage >= 50 ? "bg-amber-400" : "bg-red-500"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className={cn(
          "text-center text-sm font-bold",
          percentage >= 80 ? "text-green-400" : percentage >= 50 ? "text-amber-400" : "text-red-400"
        )}>
          {percentage}% de acierto
        </div>
      </div>

      {/* XP Breakdown */}
      <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-6 space-y-3">
        <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest">Puntos ganados</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Target className="h-4 w-4 text-blue-400" />
              {correct} aciertos
            </div>
            <span className="text-sm font-bold text-white tabular-nums">+{correct * 100} XP</span>
          </div>
          {maxCombo > 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Flame className="h-4 w-4 text-orange-400" />
                Racha x{maxCombo}
              </div>
              <span className="text-sm font-bold text-white tabular-nums">+{maxCombo * 25} XP</span>
            </div>
          )}
          {wasPerfect && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Trophy className="h-4 w-4 text-yellow-400" />
                Bonus perfecto
              </div>
              <span className="text-sm font-bold text-white tabular-nums">+200 XP</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-3 flex items-center justify-between">
            <span className="text-base font-bold text-white/70">Total</span>
            <span className="text-2xl font-black text-yellow-400 tabular-nums">
              <AnimatedScore value={xpEarned} /> XP
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {hasNextNode && onNextNode && (
          <button
            onClick={onNextNode}
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-4 text-base font-black text-white hover:from-green-600 hover:to-emerald-700 transition-all active:scale-[0.98] shadow-lg"
          >
            Siguiente nodo
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-indigo-500/80 text-white font-black text-base py-4 hover:bg-indigo-500 transition-all active:scale-[0.98] shadow-lg border border-indigo-400/30"
        >
          <RefreshCw className="h-5 w-5" />
          Jugar otra ronda
        </button>
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-white/5 text-white/50 font-bold text-base py-4 hover:bg-white/10 hover:text-white/70 transition-all active:scale-[0.98]"
        >
          <BookOpen className="h-5 w-5" />
          Volver a la sala de estudio
        </button>
      </div>
    </div>
  );
}
