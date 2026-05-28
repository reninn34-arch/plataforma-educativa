"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { BookOpen, Users, Clock, ClipboardList, Pencil, BarChart3, ClipboardCheck, User } from "lucide-react";

const teacherLinks = [
  { href: "/teacher/cursos", label: "Mis Cursos", icon: BookOpen },
  { href: "/teacher/dashboard", label: "Panel Principal", icon: Users },
  { href: "/teacher/horario", label: "Horario", icon: Clock },
  { href: "/teacher/asistencia", label: "Asistencia", icon: ClipboardList },
  { href: "/teacher/assignments", label: "Tareas", icon: Pencil },
  { href: "/teacher/analytics", label: "Analiticas IA", icon: BarChart3 },
  { href: "/teacher/grades", label: "Calificaciones", icon: ClipboardCheck },
  { href: "/teacher/profile", label: "Mi Perfil", icon: User },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout role="teacher" links={teacherLinks} title="Administracion Docente">
      {children}
    </AppLayout>
  );
}
