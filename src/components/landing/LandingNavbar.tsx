"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Menu, X } from "lucide-react";

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "#courses", label: "Cursos" },
    { href: "#features", label: "Características" },
    { href: "#how-it-works", label: "Cómo funciona" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200/50 transition-transform group-hover:scale-105">
            <GraduationCap size={20} className="text-white" />
          </div>
          <span className="text-lg font-extrabold text-foreground">Atlas Edu</span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex h-9 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200/50 px-5 text-sm font-semibold transition-all hover:-translate-y-0.5"
          >
            Iniciar sesión
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="flex sm:hidden h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            aria-label="Menú"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="sm:hidden border-t border-border/50 bg-background/95 backdrop-blur-lg animate-slide-down">
          <div className="px-4 py-4 space-y-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors mt-2"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
