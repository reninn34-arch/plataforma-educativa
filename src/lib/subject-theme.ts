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

const dynamicPalettes = [
  { accent: "rose",    header: "from-rose-600 to-pink-500",    bgLight: "bg-rose-50",    border: "border-rose-200",    ring: "ring-rose-500/20",    text: "text-rose-700",    primary: "bg-rose-600 hover:bg-rose-700",    progress: "bg-rose-500",    gradient: "from-rose-500 to-pink-500" },
  { accent: "sky",     header: "from-sky-600 to-cyan-500",     bgLight: "bg-sky-50",     border: "border-sky-200",     ring: "ring-sky-500/20",     text: "text-sky-700",     primary: "bg-sky-600 hover:bg-sky-700",     progress: "bg-sky-500",     gradient: "from-sky-500 to-cyan-500" },
  { accent: "lime",    header: "from-lime-600 to-green-500",   bgLight: "bg-lime-50",    border: "border-lime-200",    ring: "ring-lime-500/20",    text: "text-lime-700",    primary: "bg-lime-600 hover:bg-lime-700",    progress: "bg-lime-500",    gradient: "from-lime-500 to-green-500" },
  { accent: "teal",    header: "from-teal-600 to-cyan-500",    bgLight: "bg-teal-50",    border: "border-teal-200",    ring: "ring-teal-500/20",    text: "text-teal-700",    primary: "bg-teal-600 hover:bg-teal-700",    progress: "bg-teal-500",    gradient: "from-teal-500 to-cyan-500" },
  { accent: "orange",  header: "from-orange-600 to-amber-500", bgLight: "bg-orange-50",  border: "border-orange-200",  ring: "ring-orange-500/20",  text: "text-orange-700",  primary: "bg-orange-600 hover:bg-orange-700",  progress: "bg-orange-500",  gradient: "from-orange-500 to-amber-500" },
  { accent: "pink",    header: "from-pink-600 to-rose-500",    bgLight: "bg-pink-50",    border: "border-pink-200",    ring: "ring-pink-500/20",    text: "text-pink-700",    primary: "bg-pink-600 hover:bg-pink-700",    progress: "bg-pink-500",    gradient: "from-pink-500 to-rose-500" },
  { accent: "cyan",    header: "from-cyan-600 to-blue-500",    bgLight: "bg-cyan-50",    border: "border-cyan-200",    ring: "ring-cyan-500/20",    text: "text-cyan-700",    primary: "bg-cyan-600 hover:bg-cyan-700",    progress: "bg-cyan-500",    gradient: "from-cyan-500 to-blue-500" },
  { accent: "fuchsia", header: "from-fuchsia-600 to-purple-500", bgLight: "bg-fuchsia-50", border: "border-fuchsia-200", ring: "ring-fuchsia-500/20", text: "text-fuchsia-700", primary: "bg-fuchsia-600 hover:bg-fuchsia-700", progress: "bg-fuchsia-500", gradient: "from-fuchsia-500 to-purple-500" },
];

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    const char = slug.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function subjectTheme(subjectSlug: string) {
  const explicit = themes[subjectSlug as SubjectSlug];
  if (explicit) return explicit;
  const idx = hashSlug(subjectSlug) % dynamicPalettes.length;
  return dynamicPalettes[idx];
}
