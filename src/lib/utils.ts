import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SUBJECTS = [
  { id: "matematicas", name: "Matematicas", emoji: "🔢", color: "#2563EB" },
  { id: "lenguaje", name: "Lenguaje", emoji: "📖", color: "#16A34A" },
  { id: "ciencias", name: "Ciencias", emoji: "🔬", color: "#8B5CF6" },
  { id: "sociales", name: "Sociales", emoji: "🌎", color: "#D97706" },
] as const;
