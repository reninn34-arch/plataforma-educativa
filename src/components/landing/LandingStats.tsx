"use client";

import { useEffect, useRef, useState } from "react";
import { Users, BookOpen, Brain, Award } from "lucide-react";

const stats = [
  { icon: Users, label: "Estudiantes activos", value: 500, suffix: "+" },
  { icon: BookOpen, label: "Cursos disponibles", value: 50, suffix: "+" },
  { icon: Brain, label: "Ejercicios resueltos", value: 10000, suffix: "+" },
  { icon: Award, label: "Docentes calificados", value: 20, suffix: "+" },
];

function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const duration = 1500;
          const start = performance.now();

          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));

            if (progress < 1) requestAnimationFrame(animate);
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  );
}

export function LandingStats() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative py-16 sm:py-32 bg-gradient-to-br from-indigo-600 to-violet-700 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 relative">
        <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
          <h2 className={`text-2xl sm:text-4xl font-extrabold tracking-tight text-white ${visible ? "animate-fade-in-up" : "opacity-0"}`}>
            Atlas Edu en números
          </h2>
          <p className={`mt-3 sm:mt-4 text-indigo-200 text-sm sm:text-lg ${visible ? "animate-fade-in-up" : "opacity-0"}`}>
            El impacto de nuestra plataforma en la comunidad educativa PCEI.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center ${visible ? "animate-fade-in-up" : "opacity-0"}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="mx-auto mb-3 sm:mb-4 flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <stat.icon size={22} className="text-white sm:size-7" />
              </div>
              <p className="text-2xl sm:text-4xl font-extrabold text-white mb-1">
                <Counter target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-xs sm:text-sm text-indigo-200 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
