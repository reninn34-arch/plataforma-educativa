import { cn } from "@/lib/utils";

const themes = {
  matematicas: {
    header: "from-blue-600 to-indigo-500",
    accent: "blue",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    ring: "ring-blue-500/20",
    text: "text-blue-700",
    primary: "bg-blue-600 hover:bg-blue-700",
    progress: "bg-blue-500",
    emoji: "🔢",
    gradient: "from-blue-500 to-indigo-500",
  },
  fisica: {
    header: "from-emerald-600 to-green-500",
    accent: "emerald",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    ring: "ring-emerald-500/20",
    text: "text-emerald-700",
    primary: "bg-emerald-600 hover:bg-emerald-700",
    progress: "bg-emerald-500",
    emoji: "⚡",
    gradient: "from-emerald-500 to-green-500",
  },
  quimica: {
    header: "from-amber-600 to-yellow-500",
    accent: "amber",
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    ring: "ring-amber-500/20",
    text: "text-amber-700",
    primary: "bg-amber-600 hover:bg-amber-700",
    progress: "bg-amber-500",
    emoji: "🧪",
    gradient: "from-amber-500 to-yellow-500",
  },
  ingles: {
    header: "from-violet-600 to-purple-500",
    accent: "violet",
    bgLight: "bg-violet-50",
    border: "border-violet-200",
    ring: "ring-violet-500/20",
    text: "text-violet-700",
    primary: "bg-violet-600 hover:bg-violet-700",
    progress: "bg-violet-500",
    emoji: "🗣",
    gradient: "from-violet-500 to-purple-500",
  },
} as const;

export type SubjectSlug = keyof typeof themes;

export function subjectTheme(subjectSlug: string) {
  return themes[subjectSlug as SubjectSlug] || themes.matematicas;
}
