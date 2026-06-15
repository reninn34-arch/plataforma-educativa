"use client";

import { useEffect, useState, useRef } from "react";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const ACCENT_COLORS = {
  indigo: { light: "#4F46E5", dark: "#818CF8", bg: "bg-indigo-600", border: "border-indigo-600/30", name: "Default" },
  blue: { light: "#2563EB", dark: "#60A5FA", bg: "bg-blue-600", border: "border-blue-600/30", name: "Azul" },
  emerald: { light: "#059669", dark: "#34D399", bg: "bg-emerald-600", border: "border-emerald-600/30", name: "Verde" },
  rose: { light: "#E11D48", dark: "#FB7185", bg: "bg-rose-600", border: "border-rose-600/30", name: "Rosa" },
  violet: { light: "#7C3AED", dark: "#A78BFA", bg: "bg-violet-600", border: "border-violet-600/30", name: "Violeta" },
  amber: { light: "#D97706", dark: "#FBBF24", bg: "bg-amber-600", border: "border-amber-600/30", name: "Ámbar" },
} as const;

export type AccentColorKey = keyof typeof ACCENT_COLORS;

export function AccentColorPicker({ role = "student", userId }: { role?: string; userId?: number }) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState<AccentColorKey>("indigo");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const storageKey = userId ? `accent-color-user-${userId}` : "accent-color-" + role;
    const stored = (localStorage.getItem(storageKey) || localStorage.getItem("accent-color-" + role) || "indigo") as AccentColorKey;
    setCurrentColor(stored);
  }, [role, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl border border-border flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  const handleSelect = (key: AccentColorKey) => {
    setCurrentColor(key);
    const storageKey = userId ? `accent-color-user-${userId}` : "accent-color-" + role;
    localStorage.setItem(storageKey, key);
    // Write cookie for immediate server/client sync
    document.cookie = `accent-color=${key}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new Event("accent-color-change"));
    // Close picker on select after a short delay for interactive feel
    setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 relative",
          isOpen && "bg-accent text-foreground ring-2 ring-primary/20"
        )}
        aria-label="Seleccionar color de énfasis"
        title="Cambiar color de énfasis"
      >
        <Palette size={16} />
        {/* Dynamic color indicator dot */}
        <span
          className={cn(
            "absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-background",
            ACCENT_COLORS[currentColor]?.bg || "bg-indigo-600"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 p-3 w-56 rounded-2xl bg-card border border-border dark:border-slate-800 shadow-xl z-50 animate-scale-in">
          <p className="text-[11px] font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Color de énfasis
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ACCENT_COLORS) as AccentColorKey[]).map((key) => {
              const colorInfo = ACCENT_COLORS[key];
              const isSelected = key === currentColor;
              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-200 hover:bg-muted border border-transparent",
                    isSelected && "border-border bg-accent/50"
                  )}
                  title={colorInfo.name}
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-white relative shadow-sm border",
                      colorInfo.bg,
                      colorInfo.border
                    )}
                  >
                    {isSelected && <Check size={12} className="stroke-[3]" />}
                  </div>
                  <span className="text-[10px] font-medium text-foreground/80 truncate max-w-full">
                    {colorInfo.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
