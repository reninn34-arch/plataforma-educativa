"use client";

import { useState, useEffect } from "react";
import { sounds } from "@/lib/sounds";

export function Countdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (count > 1) {
      sounds.countdownBeep();
      const t = setTimeout(() => setCount((c) => c - 1), 700);
      return () => clearTimeout(t);
    }
    if (count === 1) {
      sounds.countdownBeep();
      const t = setTimeout(() => {
        setHidden(true);
        sounds.countdownGo();
        onDone();
      }, 700);
      return () => clearTimeout(t);
    }
  }, [count, onDone]);

  if (hidden) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div
        key={count}
        className="text-[80px] sm:text-[120px] font-extrabold text-primary select-none animate-scale-in"
        style={{ animationDuration: "500ms", animationIterationCount: "1" }}
      >
        {count}
      </div>
    </div>
  );
}
