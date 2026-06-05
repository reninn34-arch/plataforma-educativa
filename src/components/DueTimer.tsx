"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface DueTimerProps {
  dueDate: string | null;
  compact?: boolean;
}

function formatTimeLeft(ms: number): { label: string; dateTime: string; urgent: "normal" | "soon" | "critical" | "expired" } {
  if (ms <= 0) return { label: "Vencida", dateTime: "", urgent: "expired" };

  const totalMinutes = Math.floor(ms / 60000);
  const totalHours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  const deadline = new Date(Date.now() + ms);
  const timeStr = deadline.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
  const dateStr = deadline.toLocaleDateString("es-EC", { day: "numeric", month: "short" });

  if (days > 0) {
    return {
      label: `${dateStr}, ${timeStr}`,
      dateTime: `(${days}d)`,
      urgent: "normal",
    };
  }

  if (totalHours >= 6) {
    return { label: `Hoy, ${timeStr}`, dateTime: `(${totalHours}h)`, urgent: "soon" };
  }

  if (totalHours >= 1) {
    return { label: `${totalHours}h ${minutes}m`, dateTime: timeStr, urgent: "critical" };
  }

  if (minutes >= 1) {
    return { label: `${minutes} min`, dateTime: timeStr, urgent: "critical" };
  }

  return { label: "Ahora", dateTime: timeStr, urgent: "critical" };
}

export function DueTimer({ dueDate, compact = false }: DueTimerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!dueDate) return;
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, [dueDate]);

  if (!dueDate) return null;

  const msLeft = new Date(dueDate).getTime() - Date.now();
  const { label, dateTime, urgent } = formatTimeLeft(msLeft);

  const colors: Record<string, string> = {
    normal: "bg-blue-50 text-blue-700 border-blue-200",
    soon: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-red-50 text-red-700 border-red-200",
    expired: "bg-muted text-muted-foreground border-border",
  };

  const icons: Record<string, string> = {
    normal: "📅",
    soon: "⏰",
    critical: "🔴",
    expired: "❌",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${colors[urgent]} ${urgent === "critical" ? "animate-pulse-soft" : ""}`}>
      {compact ? (
        <span className="leading-none">{icons[urgent]}</span>
      ) : (
        <Clock size={12} className="shrink-0" />
      )}
      {label}
      {dateTime && <span className="opacity-60 ml-0.5 font-normal">{dateTime}</span>}
    </span>
  );
}
