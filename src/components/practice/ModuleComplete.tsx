"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, Home, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleCompleteProps {
  correct: number;
  total: number;
  xpEarned: number;
  maxCombo: number;
  moduleTitle: string;
  onNextModule: () => void;
  onBack: () => void;
}

export function ModuleComplete({
  correct,
  total,
  xpEarned,
  maxCombo,
  moduleTitle,
  onNextModule,
  onBack,
}: ModuleCompleteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsEarned = total > 0
    ? (correct === total ? 3 : correct >= total * 0.6 ? 2 : correct > 0 ? 1 : 0)
    : 0;

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

    const colors = ["#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-slate-900/90 via-slate-800/90 to-slate-900/90 animate-fade-in-up">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-sm w-full px-6 text-center animate-scale-in">
        {/* Trophy / Star cluster */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-bounce-in"
              style={{ animationDelay: `${i * 200}ms` }}
            >
              <div className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg transition-all",
                i <= starsEarned
                  ? "bg-gradient-to-br from-yellow-400 to-yellow-500 scale-100"
                  : "bg-slate-700/50 scale-75 opacity-40"
              )}>
                <Star className={cn(
                  "h-8 w-8",
                  i <= starsEarned ? "text-white fill-white" : "text-slate-500"
                )} />
              </div>
            </div>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-white mb-2 drop-shadow-lg">
          ¡Modulo completado!
        </h1>
        <p className="text-lg font-medium text-yellow-300 mb-8 drop-shadow">
          {moduleTitle}
        </p>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-3">
            <p className="text-2xl font-extrabold text-white">{correct}/{total}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Aciertos</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-3">
            <p className="text-2xl font-extrabold text-yellow-300">+{xpEarned}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">XP</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-3">
            <div className="flex items-center justify-center gap-1">
              <Zap className="h-5 w-5 text-amber-400" />
              <span className="text-2xl font-extrabold text-amber-400">{maxCombo}</span>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Racha</p>
          </div>
        </div>

        {/* Next module button */}
        <button
          onClick={onNextModule}
          className="group w-full rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 py-4 px-6 text-white font-extrabold text-lg shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all mb-3 flex items-center justify-center gap-2"
        >
          Siguiente modulo
          <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={onBack}
          className="w-full rounded-xl py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <Home className="h-4 w-4" />
          Volver a la sala de estudio
        </button>
      </div>
    </div>
  );
}
