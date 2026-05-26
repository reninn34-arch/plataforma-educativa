"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Users, Pencil, BarChart3, ClipboardCheck, User } from "lucide-react";

const teacherLinks = [
  { href: "/teacher/dashboard", label: "Panel Principal", icon: Users },
  { href: "/teacher/assignments", label: "Tareas", icon: Pencil },
  { href: "/teacher/analytics", label: "Analíticas IA", icon: BarChart3 },
  { href: "/teacher/grades", label: "Calificaciones", icon: ClipboardCheck },
  { href: "/teacher/profile", label: "Mi Perfil", icon: User },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout role="teacher" links={teacherLinks} title="Administración Docente">
      {children}
    </AppLayout>
  );
}
