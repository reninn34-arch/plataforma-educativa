"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function HeartIcon({ filled, breaking }: { filled: boolean; breaking: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "#EF4444" : "none"}
      stroke={filled ? "#EF4444" : "#D1D5DB"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "transition-all duration-300",
        breaking && "animate-heart-break",
        filled && !breaking && "animate-heartbeat"
      )}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export function Hearts({ lives, maxLives }: { lives: number; maxLives: number }) {
  const prevLives = useRef(lives);
  const [breakingIndex, setBreakingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lives < prevLives.current) {
      setBreakingIndex(lives);
      const timer = setTimeout(() => setBreakingIndex(null), 500);
      prevLives.current = lives;
      return () => clearTimeout(timer);
    }
    if (lives > prevLives.current) {
      prevLives.current = lives;
    }
  }, [lives]);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxLives }).map((_, i) => {
        const filled = i < lives;
        const breaking = i === breakingIndex;
        return (
          <span
            key={i}
            className={cn(
              "transition-all duration-300 inline-flex",
              filled || breaking ? "opacity-100" : "opacity-30"
            )}
          >
            <HeartIcon filled={filled} breaking={breaking} />
          </span>
        );
      })}
    </div>
  );
}
