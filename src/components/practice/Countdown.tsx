"use client";

import { useState, useEffect } from "react";

export function Countdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (count <= 0) {
      setVisible(false);
      const t = setTimeout(onDone, 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [count, onDone]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div
        key={count}
        className="text-[120px] font-extrabold text-primary select-none animate-scale-in"
        style={{ animationDuration: "500ms", animationIterationCount: "1" }}
      >
        {count}
      </div>
    </div>
  );
}
