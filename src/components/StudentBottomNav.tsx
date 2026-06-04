"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Award, Calendar, User } from "lucide-react";

const links = [
  { href: "/student/dashboard", label: "Inicio", icon: Home },
  { href: "/student/assignments", label: "Tareas", icon: ClipboardList },
  { href: "/student/grades", label: "Notas", icon: Award },
  { href: "/student/calendar", label: "Calendario", icon: Calendar },
  { href: "/student/profile", label: "Perfil", icon: User },
];

export function StudentBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/student/dashboard") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 safe-area-bottom px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 px-3 py-1 rounded-xl transition-all duration-200 ${
                active
                  ? "text-indigo-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors duration-200 ${
                active ? "bg-indigo-50" : ""
              }`}>
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              </div>
              <span className={`text-[10px] font-semibold ${
                active ? "text-indigo-600" : "text-slate-400"
              }`}>{label}</span>
              {active && (
                <div className="absolute -top-0.5 w-6 h-0.5 rounded-full bg-indigo-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
