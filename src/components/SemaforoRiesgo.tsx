"use client";

import { cn } from "@/lib/utils";

type RiskLevel = "green" | "yellow" | "red";

interface SemaforoRiesgoProps {
  daysInactive: number;
  consecutiveFailures: number;
}

function getRiskLevel(daysInactive: number, consecutiveFailures: number): RiskLevel {
  if (daysInactive >= 7 || consecutiveFailures >= 5) return "red";
  if (daysInactive >= 3 || consecutiveFailures >= 3) return "yellow";
  return "green";
}

function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case "green": return "Activo";
    case "yellow": return "En Riesgo";
    case "red": return "Deserción";
  }
}

export function SemaforoRiesgo({ daysInactive, consecutiveFailures }: SemaforoRiesgoProps) {
  const level = getRiskLevel(daysInactive, consecutiveFailures);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 p-1 rounded-md bg-muted/60 border border-border">
        {(["red", "yellow", "green"] as RiskLevel[]).map((color) => (
          <div
            key={color}
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-all duration-300",
              color === "red" && (level === "red"
                ? "bg-red-500 shadow-sm shadow-destructive/40 scale-125 animate-pulse"
                : "bg-red-200"),
              color === "yellow" && (level === "yellow"
                ? "bg-[#D97706] shadow-sm shadow-amber-400/40 scale-125"
                : "bg-amber-200"),
              color === "green" && (level === "green"
                ? "bg-emerald-500 shadow-sm shadow-emerald-400/40 scale-125"
                : "bg-emerald-200"),
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
          level === "green" && "bg-emerald-50 text-emerald-700 border-emerald-200",
          level === "yellow" && "bg-amber-50 text-amber-700 border-amber-200",
          level === "red" && "bg-red-50 text-red-600 border-red-200 animate-pulse",
        )}
      >
        {getRiskLabel(level)}
      </span>
    </div>
  );
}
