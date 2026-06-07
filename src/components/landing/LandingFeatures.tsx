"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Brain, LineChart, Clock, Smartphone, BookOpen } from "lucide-react";
import { TutorChatSVG } from "./TutorChatSVG";
import { PracticeGameSVG } from "./PracticeGameSVG";

const spotlightFeatures = [
  {
    icon: Bot,
    title: "Tutor de Aprendizaje",
    description: "No te damos respuestas. Te guiamos paso a paso con el método socrático para que aprendas resolviéndolo tú mismo.",
  },
  {
    icon: Brain,
    title: "Práctica interactiva",
    description: "Ejercicios con retroalimentación inmediata. Cada error es una oportunidad de aprender: el sistema te explica por qué fallaste y cómo mejorar.",
  },
];

const gridFeatures = [
  {
    icon: LineChart,
    title: "Seguimiento de progreso",
    description: "Gráficos claros de tu avance. Sabes exactamente qué dominas y qué necesitas repasar.",
  },
  {
    icon: Clock,
    title: "Horarios flexibles",
    description: "Estudia a tu ritmo, cuando y donde quieras. La plataforma se adapta a tu disponibilidad.",
  },
  {
    icon: Smartphone,
    title: "Acceso multiplataforma",
    description: "Celular, tablet o computador. Toda tu información sincronizada en tiempo real.",
  },
  {
    icon: BookOpen,
    title: "Materiales actualizados",
    description: "Contenido alineado al currículo PCEI. Guías, videos y recursos de docentes calificados.",
  },
];

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

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [ref, visible] = useOnScreen();
  return (
    <div
      ref={ref}
      className={`${className}`}
    >
      <div className={`${visible ? "animate-fade-in-up" : "opacity-0"}`} style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </div>
  );
}

export function LandingFeatures() {
  const [headingRef, headingVisible] = useOnScreen();

  return (
    <section id="features" className="relative py-16 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div ref={headingRef} className="mx-auto max-w-2xl text-center mb-12 sm:mb-20">
          <div className={`${headingVisible ? "animate-fade-in-up" : "opacity-0"}`}>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Todo lo que necesitas para{" "}
              <span className="text-indigo-600 dark:text-indigo-400">aprender mejor</span>
            </h2>
            <p className="mt-3 sm:mt-4 text-muted-foreground text-sm sm:text-lg">
              Herramientas diseñadas para potenciar tu aprendizaje y hacer más efectivo cada minuto de estudio.
            </p>
          </div>
        </div>

        {spotlightFeatures.map((feature, i) => (
          <SpotlightRow key={feature.title} feature={feature} index={i} />
        ))}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {gridFeatures.map((feature, i) => (
            <AnimatedSection key={feature.title} delay={i * 0.08}>
              <div className="group rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:border-indigo-800 dark:hover:shadow-indigo-950/30 h-full">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 transition-colors duration-300 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-600">
                  <feature.icon size={20} />
                </div>
                <h4 className="text-base font-bold mb-1.5">{feature.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpotlightRow({ feature, index }: { feature: typeof spotlightFeatures[number]; index: number }) {
  const [ref, visible] = useOnScreen();
  const isEven = index % 2 === 0;

  return (
    <div ref={ref} className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"} items-center gap-8 sm:gap-12 lg:gap-20 mb-12 sm:mb-20 last:mb-8 sm:last:mb-16`}>
      <div className={`flex-1 ${visible ? "animate-fade-in-up" : "opacity-0"}`} style={{ animationDelay: "0.1s" }}>
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200/50 dark:shadow-indigo-950/30">
          <feature.icon size={28} className="text-white" />
        </div>
        <h3 className="text-2xl font-extrabold mb-3">{feature.title}</h3>
        <p className="text-muted-foreground text-base leading-relaxed max-w-lg">{feature.description}</p>
      </div>
      <div className={`flex-1 w-full ${visible ? "animate-fade-in-up" : "opacity-0"}`} style={{ animationDelay: "0.2s" }}>
        <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-indigo-100 via-indigo-50 to-violet-100 dark:from-indigo-950/50 dark:via-indigo-900/30 dark:to-violet-950/50 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center justify-center p-6">
          {index === 0 ? (
            <TutorChatSVG className="w-full h-full" />
          ) : (
            <PracticeGameSVG className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}
