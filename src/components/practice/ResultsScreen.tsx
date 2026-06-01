"use client";

import { useEffect, useState } from "react";
import { Trophy, Star, Flame, Target, RefreshCw, BookOpen, ChevronRight } from "lucide-react";
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
  const [showStars, setShowStars] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowStars(true), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (wasPerfect) sounds.achievement();
  }, [wasPerfect]);

  useEffect(() => {
    if (wasPerfect || starsEarned >= 2) {
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
  }, [wasPerfect, starsEarned]);

  return (
    <div className="animate-scale-in space-y-6">
      {/* Trophy */}
      <div className="flex flex-col items-center py-4">
        <div className={cn(
          "flex h-24 w-24 items-center justify-center rounded-full mb-4 shadow-lg",
          wasPerfect ? "bg-gradient-to-br from-yellow-400 to-amber-500" :
          stars >= 2 ? "bg-gradient-to-br from-blue-400 to-blue-600" :
          "bg-gradient-to-br from-slate-400 to-slate-500"
        )}>
          {wasPerfect ? (
            <Trophy className="h-12 w-12 text-white animate-bounce-in" />
          ) : (
            <Star className="h-12 w-12 text-white" />
          )}
        </div>
        <h2 className="text-2xl font-extrabold text-foreground">
          {wasPerfect ? "PERFECTO!" : stars >= 2 ? "Buen trabajo!" : "Sigue intentando"}
        </h2>
        <div className="flex items-center gap-2 mt-2">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              className={cn(
                "h-8 w-8 transition-all duration-500",
                s <= stars
                  ? "text-yellow-400 fill-yellow-400 animate-bounce-in"
                  : "text-muted-foreground/20",
                showStars && `transition-delay-[${(s - 1) * 200}ms]`
              )}
              style={showStars && s <= stars ? { animationDelay: `${(s - 1) * 200}ms` } : undefined}
            />
          ))}
        </div>
        {starsEarned > 0 && (
          <p className="text-sm text-yellow-600 font-semibold mt-2 animate-count-up">
            ⭐ Ganaste {starsEarned} {starsEarned === 1 ? "estrella" : "estrellas"} en este nodo
          </p>
        )}
      </div>

      {/* Score */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Respuestas correctas</span>
          <span className="text-lg font-bold text-foreground">
            {correct}/{total} ({percentage}%)
          </span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              percentage >= 80 ? "bg-emerald-500" : percentage >= 50 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* XP Breakdown */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Puntos ganados</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Target className="h-4 w-4 text-blue-500" />
              {correct} aciertos
            </div>
            <span className="text-sm font-bold text-foreground">+{correct * 100} XP</span>
          </div>
          {maxCombo > 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Flame className="h-4 w-4 text-orange-500" />
                Racha x{maxCombo}
              </div>
              <span className="text-sm font-bold text-foreground">+{maxCombo * 25} XP</span>
            </div>
          )}
          {wasPerfect && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Bonus perfecto
              </div>
              <span className="text-sm font-bold text-foreground">+200 XP</span>
            </div>
          )}
          <div className="border-t pt-2.5 flex items-center justify-between">
            <span className="text-base font-bold text-foreground">Total</span>
            <span className="text-xl font-extrabold text-primary tabular-nums">
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
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-500 py-4 text-base font-bold text-white hover:bg-emerald-600 transition-all active:scale-[0.98] shadow-sm"
          >
            Siguiente nodo
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] shadow-sm"
        >
          <RefreshCw className="h-5 w-5" />
          Jugar otra ronda
        </button>
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 w-full rounded-xl border-2 bg-card py-4 text-base font-bold text-foreground hover:bg-muted transition-all active:scale-[0.98]"
        >
          <BookOpen className="h-5 w-5" />
          Volver a la sala de estudio
        </button>
      </div>
    </div>
  );
}
