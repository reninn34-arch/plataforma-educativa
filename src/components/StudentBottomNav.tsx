"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Award, Calendar, User } from "lucide-react";

const links = [
  { href: "/student/dashboard", label: "Inicio", icon: Home },
  { href: "/student/grades", label: "Notas", icon: Award },
  { href: "/student/calendar", label: "Calendario", icon: Calendar },
  { href: "/student/profile", label: "Perfil", icon: User },
];

export function StudentBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
      <div className="flex items-center justify-around h-16 safe-area-bottom">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/student/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 px-2 py-1 rounded-lg transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
