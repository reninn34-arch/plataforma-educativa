import { cn } from "@/lib/utils";

const themes = {
  matematicas: {
    header: "from-blue-600 to-blue-500",
    accent: "blue",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    ring: "ring-blue-500/20",
    text: "text-blue-700",
    primary: "bg-blue-600 hover:bg-blue-700",
    progress: "bg-blue-500",
  },
  fisica: {
    header: "from-red-600 to-red-500",
    accent: "red",
    bgLight: "bg-red-50",
    border: "border-red-200",
    ring: "ring-red-500/20",
    text: "text-red-700",
    primary: "bg-red-600 hover:bg-red-700",
    progress: "bg-red-500",
  },
  quimica: {
    header: "from-emerald-600 to-emerald-500",
    accent: "emerald",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    ring: "ring-emerald-500/20",
    text: "text-emerald-700",
    primary: "bg-emerald-600 hover:bg-emerald-700",
    progress: "bg-emerald-500",
  },
  ingles: {
    header: "from-orange-600 to-orange-500",
    accent: "orange",
    bgLight: "bg-orange-50",
    border: "border-orange-200",
    ring: "ring-orange-500/20",
    text: "text-orange-700",
    primary: "bg-orange-600 hover:bg-orange-700",
    progress: "bg-orange-500",
  },
} as const;

export type SubjectSlug = keyof typeof themes;

export function subjectTheme(subjectSlug: string) {
  return themes[subjectSlug as SubjectSlug] || themes.matematicas;
}
