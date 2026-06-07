"use client";

import { useEffect, useRef, useState } from "react";

function useOnScreen(threshold = 0.15) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}

const courses = [
  {
    name: "Matemáticas",
    icon: "📐",
    color: "from-indigo-500 to-blue-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    textColor: "text-indigo-700 dark:text-indigo-300",
    description: "Álgebra, geometría, trigonometría y cálculo.",
  },
  {
    name: "Física",
    icon: "⚛️",
    color: "from-emerald-500 to-teal-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    textColor: "text-emerald-700 dark:text-emerald-300",
    description: "Mecánica, termodinámica, óptica y electromagnetismo.",
  },
  {
    name: "Química",
    icon: "🧪",
    color: "from-red-500 to-rose-600",
    bgColor: "bg-red-50 dark:bg-red-950/40",
    borderColor: "border-red-200 dark:border-red-800",
    textColor: "text-red-700 dark:text-red-300",
    description: "Tabla periódica, reacciones, estequiometría y laboratorio.",
  },
  {
    name: "Inglés",
    icon: "🌍",
    color: "from-amber-500 to-orange-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800",
    textColor: "text-amber-700 dark:text-amber-300",
    description: "Gramática, vocabulario, lectura y conversación.",
  },
];

export function CoursesSection() {
  const [headingRef, headingVisible] = useOnScreen();

  return (
    <section id="courses" className="relative py-16 sm:py-32 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div ref={headingRef} className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
          <div className={`${headingVisible ? "animate-fade-in-up" : "opacity-0"}`}>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Explora nuestros{" "}
              <span className="text-indigo-600 dark:text-indigo-400">cursos</span>
            </h2>
            <p className="mt-3 sm:mt-4 text-muted-foreground text-sm sm:text-lg">
              Contenido alineado al currículo PCEI con material interactivo y seguimiento personalizado.
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((course, i) => (
            <CourseCard key={course.name} course={course} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CourseCard({ course, index }: { course: typeof courses[number]; index: number }) {
  const [ref, visible] = useOnScreen();

  return (
    <div ref={ref} className={`${visible ? "animate-fade-in-up" : "opacity-0"}`} style={{ animationDelay: `${index * 0.1}s` }}>
      <div className={`group rounded-2xl border ${course.borderColor} ${course.bgColor} p-6 transition-all duration-300 hover:shadow-lg hover:shadow-${course.color.split(" ")[0].replace("from-", "")}/10 h-full`}>
        <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${course.color} shadow-lg text-2xl`}>
          <span>{course.icon}</span>
        </div>
        <h4 className={`text-lg font-bold mb-0.5 ${course.textColor}`}>{course.name}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
      </div>
    </div>
  );
}
