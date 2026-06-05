"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const lastSavedTheme = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl border border-border flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-accent" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  const handleToggle = async () => {
    const newTheme = isDark ? "light" : "dark";
    setTheme(newTheme);

    if (lastSavedTheme.current !== newTheme) {
      lastSavedTheme.current = newTheme;
      try {
        await fetch("/api/user/theme", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: newTheme }),
        });
      } catch (e) {
        // Silent fail - localStorage still works
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label={isDark ? "Modo claro" : "Modo oscuro"}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
