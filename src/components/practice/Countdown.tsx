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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A0533]">
      <div
        key={count}
        className="text-[100px] sm:text-[140px] font-extrabold text-white select-none animate-scale-in drop-shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
        style={{ animationDuration: "500ms", animationIterationCount: "1" }}
      >
        {count}
      </div>
    </div>
  );
}
