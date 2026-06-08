"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { Home, Award, Calendar, User, BookOpen, ClipboardList, Clock } from "lucide-react";
import { usePathname } from "next/navigation";

const studentLinks = [
  { href: "/student/dashboard", label: "Inicio", icon: Home },
  { href: "/student/horario", label: "Horario", icon: Clock },
  { href: "/student/assignments", label: "Tareas", icon: ClipboardList },
  { href: "/student/grades", label: "Calificaciones", icon: Award },
  { href: "/student/practice", label: "Practica IA", icon: BookOpen },
  { href: "/student/calendar", label: "Calendario", icon: Calendar },
  { href: "/student/profile", label: "Mi Perfil", icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Check if we are inside a practice session node: /student/path/[slug]/[nodeId]
  const isFullScreen = pathname?.includes("/path/") && pathname?.split("/").length >= 5;

  return (
    <AppLayout role="student" links={studentLinks} title="Panel del Estudiante" isFullScreen={!!isFullScreen}>
      {children}
      <AiAssistant showFab={false} />
    </AppLayout>
  );
}
