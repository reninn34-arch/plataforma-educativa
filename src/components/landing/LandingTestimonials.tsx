"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "María Fernanda",
    role: "Estudiante de Bachillerato",
    quote: "El asistente IA me ha ayudado muchísimo con matemáticas. Cuando no entiendo algo, solo le pregunto y me explica paso a paso hasta que lo comprendo.",
    rating: 5,
    initials: "MF",
    featured: true,
  },
  {
    name: "Carlos Mendoza",
    role: "Estudiante PCEI",
    quote: "Poder estudiar a mi ritmo es lo mejor. Trabajo todo el día y en la noche reviso los materiales, hago ejercicios y veo mi progreso.",
    rating: 5,
    initials: "CM",
    featured: false,
  },
  {
    name: "Ana Lucía",
    role: "Estudiante de Ciencias",
    quote: "Con los reportes de progreso sé exactamente qué materias tengo que reforzar. Mis notas han mejorado un montón desde que uso Atlas Edu.",
    rating: 5,
    initials: "AL",
    featured: false,
  },
  {
    name: "Diego Torres",
    role: "Estudiante PCEI",
    quote: "La práctica interactiva es adictiva. Cada ejercicio tiene retroalimentación inmediata. Mucho mejor que un libro tradicional.",
    rating: 4,
    initials: "DT",
    featured: false,
  },
  {
    name: "Sofía Ramírez",
    role: "Estudiante de Bachillerato",
    quote: "Puedo acceder desde mi celular en el bus de vuelta a casa. Aprovecho cada momento libre para practicar y avanzar en mis cursos.",
    rating: 5,
    initials: "SR",
    featured: false,
  },
];

export function LandingTestimonials() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const featured = testimonials[0];
  const rest = testimonials.slice(1);

  return (
    <section id="testimonials" ref={ref} className="relative py-16 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Lo que dicen los{" "}
            <span className="text-indigo-600 dark:text-indigo-400">estudiantes</span>
          </h2>
          <p className="mt-3 sm:mt-4 text-muted-foreground text-sm sm:text-lg">
            Miles de estudiantes ya están aprendiendo con Atlas Edu. Esto es lo que opinan.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div
            className={`lg:col-span-1 lg:row-span-2 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-card p-5 sm:p-8 flex flex-col justify-between ${visible ? "animate-fade-in-up" : "opacity-0"}`}
            style={{ animationDelay: "0.05s" }}
          >
            <div>
              <div className="flex gap-1 mb-5">
                {Array.from({ length: 5 }, (_, j) => (
                  <Star key={j} size={18} className="fill-amber-400 text-amber-400" />
                ))}
              </div>

              <blockquote className="text-sm sm:text-lg text-foreground leading-relaxed font-medium mb-4 sm:mb-6">
                &ldquo;{featured.quote}&rdquo;
              </blockquote>
            </div>

            <div className="flex items-center gap-3 pt-5 border-t border-indigo-200/40 dark:border-indigo-800/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold">
                {featured.initials}
              </div>
              <div>
                <p className="font-bold">{featured.name}</p>
                <p className="text-sm text-muted-foreground">{featured.role}</p>
              </div>
            </div>
          </div>

          {rest.map((t, i) => (
            <div
              key={t.name}
              className={`rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-indigo-200 dark:hover:border-indigo-800 ${visible ? "animate-fade-in-up" : "opacity-0"}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }, (_, j) => (
                  <Star
                    key={j}
                    size={13}
                    className={j < t.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
                  />
                ))}
              </div>

              <blockquote className="text-sm text-muted-foreground leading-relaxed mb-4">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
