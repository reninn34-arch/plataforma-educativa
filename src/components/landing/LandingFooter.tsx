"use client";

import Link from "next/link";
import { GraduationCap, Heart } from "lucide-react";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
                <GraduationCap size={20} className="text-white" />
              </div>
              <span className="text-lg font-extrabold">Atlas Edu</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Plataforma educativa acelerada para adultos. PCEI - Programa de
              Educación Continua para adultos.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider text-muted-foreground/70">
              Navegación
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Inicio
                </Link>
              </li>
              <li>
                <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Características
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cómo funciona
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider text-muted-foreground/70">
              Acceso
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link href="/recuperar-pin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Recuperar PIN
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider text-muted-foreground/70">
              Legal
            </h4>
            <ul className="space-y-3">
              <li>
                <span className="text-sm text-muted-foreground cursor-default">
                  Términos y condiciones
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground cursor-default">
                  Política de privacidad
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground cursor-default">
                  Contacto
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {year} Atlas Edu. Todos los derechos reservados.
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Hecho con <Heart size={12} className="text-red-500 fill-red-500" /> para la educación PCEI
          </p>
        </div>
      </div>
    </footer>
  );
}
