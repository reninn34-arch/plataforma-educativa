"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface ParentDashboardData {
  profile: { id: number; fullName: string; cedula: string; role: string; email?: string } | null;
  children: any[];
}

export default function ParentDashboard() {
  const { data, isLoading } = useQuery<ParentDashboardData, Error>({
    queryKey: ["parent-dashboard"],
    queryFn: async () => {
      const res = await apiFetch("/api/dashboard/parent");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  );

  const profile = data?.profile;
  const children = data?.children || [];

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="border-b pb-6">
        <h1 className="text-2xl font-bold text-foreground">Panel de Representante</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profile?.fullName && <span>Bienvenido, {profile.fullName}. </span>}
          Monitorea el progreso de tus representados
        </p>
      </div>

      {children.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 font-medium text-muted-foreground">No tienes estudiantes vinculados</p>
            <p className="text-sm text-muted-foreground mt-1">Contacta al administrador para vincular tu cuenta</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {children.map((child: any) => (
            <Card key={child.studentId} className="shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold">
                    {child.studentName?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{child.studentName}</p>
                    <p className="text-xs text-muted-foreground">{child.studentCedula}</p>
                  </div>
                </div>

                {child.cursos && child.cursos.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cursos</p>
                    <div className="space-y-1">
                      {child.cursos.map((c: any) => (
                        <div key={c.cursoId} className="flex items-center justify-between text-xs">
                          <span>{c.cursoNombre}</span>
                          <Badge variant="outline" className="text-[10px]">{c.progress}% progreso</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {child.grades && child.grades.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notas</p>
                    <div className="flex flex-wrap gap-1">
                      {child.grades.map((g: any, i: number) => (
                        <Badge key={i} variant={g.value >= 7 ? "default" : "destructive"} className="text-[10px] gap-1">
                          <span>{g.emoji}</span> {g.value?.toFixed(1) || "—"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}