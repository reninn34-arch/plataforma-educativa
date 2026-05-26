"use client";

import { useEffect, useRef } from "react";

export function TimerRing({
  seconds,
  total,
  onTimeout,
  paused,
}: {
  seconds: number;
  total: number;
  onTimeout: () => void;
  paused?: boolean;
}) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / total;
  const offset = circumference * (1 - progress);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || seconds <= 0) return;

    timerRef.current = setInterval(() => {
      if (seconds <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onTimeout();
      }
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused]);

  const isUrgent = seconds <= 5;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={36} height={36} className="-rotate-90">
        <circle cx={18} cy={18} r={radius} fill="none" stroke="var(--color-muted)" strokeWidth={3} />
        <circle
          cx={18}
          cy={18}
          r={radius}
          fill="none"
          stroke={isUrgent ? "#EF4444" : seconds <= 10 ? "#F59E0B" : "#22C55E"}
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <span className={`absolute text-[11px] font-bold tabular-nums ${isUrgent ? "text-red-500 animate-pulse" : "text-muted-foreground"}`}>
        {seconds}
      </span>
    </div>
  );
}
