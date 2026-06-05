"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl border border-border dark:border-slate-700 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-accent dark:bg-slate-700" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-9 h-9 rounded-xl border border-border dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-muted-foreground dark:hover:text-slate-300 hover:bg-muted dark:hover:bg-slate-800 transition-colors"
      aria-label={isDark ? "Modo claro" : "Modo oscuro"}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
