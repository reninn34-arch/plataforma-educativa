"use client";

import Link from "next/link";
import { HeroIllustration } from "./HeroIllustration";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950">
      <div className="h-16" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-300/15 dark:bg-indigo-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-300/15 dark:bg-violet-500/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 w-full relative z-10 py-8 sm:py-16">
        <div className="flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-20">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-4 sm:mb-6 animate-fade-in-up">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Plataforma educativa PCEI
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white animate-fade-in-up">
              Tu educación,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">a tu ritmo</span>
            </h1>

            <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-slate-500 dark:text-slate-400 max-w-lg mx-auto lg:mx-0 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
              Estudia con apoyo de IA, practica con ejercicios interactivos y avanza a tu propio paso.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <Link
                href="/login"
                className="inline-flex h-11 sm:h-12 w-full sm:w-auto items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold px-7 text-sm transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-600/20"
              >
                Ingresar al portal
              </Link>
              <Link
                href="#courses"
                className="inline-flex h-11 sm:h-12 w-full sm:w-auto items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 px-6 text-sm font-semibold transition-all duration-300"
              >
                Explorar cursos
              </Link>
            </div>

            <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-400 dark:text-slate-500 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                +1,200 estudiantes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                4 materias
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                IA integrada
              </span>
            </div>
          </div>

          <div className="flex-1 flex justify-center lg:justify-end animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <HeroIllustration className="w-full max-w-xs sm:max-w-md lg:max-w-lg h-auto drop-shadow-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
