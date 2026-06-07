"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, Bot, BarChart3, Award } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: ClipboardList,
    title: "Regístrate",
    description: "Ingresa tu cédula y el PIN que te da tu institución. El proceso toma menos de un minuto.",
  },
  {
    number: "02",
    icon: Bot,
    title: "Explora y practica",
    description: "Accede a tus materias, revisa materiales y practica con ejercicios potenciados por IA.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Sigue tu progreso",
    description: "Monitorea tu avance en tiempo real. Identifica fortalezas y áreas de mejora.",
  },
  {
    number: "04",
    icon: Award,
    title: "Alcanza tus metas",
    description: "Completa tus cursos, mejora tus notas y avanza en tu educación PCEI.",
  },
];

export function LandingHowItWorks() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" ref={ref} className="relative py-16 sm:py-32 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Comienza en{" "}
            <span className="text-indigo-600 dark:text-indigo-400">4 pasos</span>
          </h2>
          <p className="mt-3 sm:mt-4 text-muted-foreground text-sm sm:text-lg">
            Diseñado para que empieces a aprender desde el primer día, sin complicaciones.
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`relative text-center group ${visible ? "animate-fade-in-up" : "opacity-0"}`}
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-px" aria-hidden>
                  <svg className="w-full h-2" viewBox="0 0 100 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 4 Q25 0 50 4 T100 4" stroke="hsl(var(--primary) / 0.25)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                  </svg>
                </div>
              )}

              <div className="mx-auto mb-4 sm:mb-5 flex h-16 w-16 sm:h-24 sm:w-24 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200/50 dark:shadow-indigo-950/30 transition-transform duration-300 group-hover:scale-105">
                <step.icon size={24} className="text-white sm:size-9" />
              </div>

              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-sm font-bold mb-3 transition-colors duration-300 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-600">
                {step.number}
              </span>

              <h3 className="text-lg font-bold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
