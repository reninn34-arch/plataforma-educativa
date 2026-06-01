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
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / total;
  const offset = circumference * (1 - progress);

  const isCritical = seconds <= 3;
  const isUrgent = seconds <= 5;

  return (
    <div className="relative inline-flex items-center justify-center">
      <div className={cn(
        "rounded-full transition-all duration-500",
        isCritical && "animate-glow-pulse"
      )}>
        <svg
          width={42}
          height={42}
          className="-rotate-90"
          style={{ transform: isCritical ? "scale(1.08)" : undefined }}
        >
          <circle cx={21} cy={21} r={radius} fill="none" stroke="var(--color-muted)" strokeWidth={3.5} />
          <circle
            cx={21}
            cy={21}
            r={radius}
            fill="none"
            stroke={isCritical ? "#EF4444" : isUrgent ? "#F59E0B" : "#22C55E"}
            strokeWidth={3.5}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
      </div>
      <span className={cn(
        "absolute text-[12px] font-bold tabular-nums transition-all duration-300",
        isCritical && "text-red-500 animate-pulse scale-110",
        !isCritical && isUrgent && "text-amber-500",
        !isUrgent && "text-muted-foreground"
      )}>
        {seconds}
      </span>
    </div>
  );
}
