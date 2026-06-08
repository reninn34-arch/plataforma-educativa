"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, Home, RefreshCw, Star, Zap, Target, Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleCompleteProps {
  correct: number;
  total: number;
  xpEarned: number;
  maxCombo: number;
  moduleTitle: string;
  onNextModule: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export function ModuleComplete({
  correct,
  total,
  xpEarned,
  maxCombo,
  moduleTitle,
  onNextModule,
  onRetry,
  onBack,
}: ModuleCompleteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsEarned = total > 0
    ? (correct === total ? 3 : correct >= total * 0.6 ? 2 : correct > 0 ? 1 : 0)
    : 0;
  const wasPerfect = correct === total;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; gravity: number;
    }[] = [];

    const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#3B82F6", "#8B5CF6", "#EC4899"];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.05 + Math.random() * 0.05,
      });
    }

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - (frame / 300));
        ctx.fill();
      }

      if (frame < 300) requestAnimationFrame(animate);
    };
    animate();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A0533] animate-fade-in-up">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-sm w-full px-6 text-center animate-scale-in space-y-8">
        {/* Trophy / Star cluster */}
        <div className="flex flex-col items-center">
          <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full mb-4 shadow-lg bg-gradient-to-br from-yellow-400 to-amber-500">
            <Trophy className="h-12 w-12 text-white animate-bounce-in" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-1 text-white">
            {wasPerfect ? "MODULO COMPLETADO!" : "Modulo completado"}
          </h1>
          <p className="text-base text-white/50 font-medium">
            {moduleTitle}
          </p>
        </div>

        {/* Stars */}
        <div className="flex items-center justify-center gap-3">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              className={cn(
                "h-10 w-10 sm:h-12 sm:w-12 transition-all duration-500",
                s <= starsEarned
                  ? "text-yellow-400 fill-yellow-400 animate-bounce-in drop-shadow-[0_0_12px_rgba(250,204,21,0.4)]"
                  : "text-white/10",
              )}
              style={{ animationDelay: `${s * 200}ms` }}
            />
          ))}
        </div>

        {/* Stats cards - Kahoot style */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-4">
            <p className="text-2xl font-black text-white tabular-nums">{correct}/{total}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Target className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Aciertos</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-4">
            <p className="text-2xl font-black text-yellow-400 tabular-nums">+{xpEarned}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">XP</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-4">
            <p className="text-2xl font-black text-amber-400 tabular-nums">{maxCombo}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Racha</p>
            </div>
          </div>
        </div>

        {/* Next module button - Kahoot style */}
        <div className="space-y-3">
          <button
            onClick={onNextModule}
            className="group w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 py-4 text-white font-black text-lg shadow-xl hover:from-green-600 hover:to-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Siguiente modulo
            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-indigo-500/80 text-white font-black text-base py-4 hover:bg-indigo-500 transition-all active:scale-[0.98] shadow-lg border border-indigo-400/30"
          >
            <RefreshCw className="h-5 w-5" />
            Jugar otra ronda
          </button>

          <button
            onClick={onBack}
            className="w-full rounded-2xl bg-white/5 text-white/50 font-bold text-base py-3 hover:bg-white/10 hover:text-white/70 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Volver a la sala de estudio
          </button>
        </div>
      </div>
    </div>
  );
}
