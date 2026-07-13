"use client";

import { useEffect, useState, useRef } from "react";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_PALETTES, type AccentColorKey } from "@/lib/accent-colors";

export function AccentColorPicker({ role = "student", userId }: { role?: string; userId?: number }) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState<AccentColorKey>("indigo");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const storageKey = userId ? `accent-color-user-${userId}` : "accent-color-" + role;
    const stored = (localStorage.getItem(storageKey) || localStorage.getItem("accent-color-" + role) || "indigo") as AccentColorKey;
    const t = setTimeout(() => setCurrentColor(stored), 0);
    return () => clearTimeout(t);
  }, [role, userId]);

  useEffect(() => {
    if (!mounted) return;
    const storageKey = userId ? `accent-color-user-${userId}` : "accent-color-" + role;
    localStorage.setItem(storageKey, currentColor);
    document.cookie = `accent-color=${currentColor}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new Event("accent-color-change"));
  }, [currentColor, role, userId, mounted]);

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
            COLOR_PALETTES[currentColor]?.bg || "bg-indigo-600"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 p-3 w-56 rounded-2xl bg-card border border-border dark:border-slate-800 shadow-xl z-50 animate-scale-in">
          <p className="text-[11px] font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Color de énfasis
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(COLOR_PALETTES) as AccentColorKey[]).map((key) => {
              const colorInfo = COLOR_PALETTES[key];
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
