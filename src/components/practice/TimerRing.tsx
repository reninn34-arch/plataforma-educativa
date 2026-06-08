"use client";

import { cn } from "@/lib/utils";

export function TimerRing({
  seconds,
  total,
  paused,
}: {
  seconds: number;
  total: number;
  onTimeout?: () => void;
  paused?: boolean;
}) {
  const progress = Math.max(seconds / total, 0);
  const isCritical = seconds <= 3;
  const isUrgent = seconds <= 5;

  return (
    <div className="w-full">
      <div className="h-2 rounded-full bg-white/15 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            isCritical ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]" : isUrgent ? "bg-amber-400" : "bg-green-400"
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className={cn(
        "text-center mt-1.5 text-xs font-bold tabular-nums tracking-wide",
        isCritical ? "text-red-400" : isUrgent ? "text-amber-400" : "text-white/50"
      )}>
        {seconds}s
      </div>
    </div>
  );
}
