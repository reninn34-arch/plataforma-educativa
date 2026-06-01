"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Home } from "lucide-react";
import { type ReactNode } from "react";

const parentLinks = [
  { href: "/parent/dashboard", label: "Inicio", icon: Home },
];

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <AppLayout role="parent" links={parentLinks} title="Portal de Padres">
      {children}
    </AppLayout>
  );
}
