"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { LayoutDashboard, Users, BookOpen, Calendar, Settings } from "lucide-react";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { type ReactNode } from "react";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
  { href: "/admin/periodos", label: "Periodos", icon: Calendar },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppLayout role="admin" links={adminLinks} title="Administración">
        {children}
      </AppLayout>
      <AiAssistant />
    </>
  );
}
