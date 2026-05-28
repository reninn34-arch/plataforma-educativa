"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, GraduationCap, BookOpen, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ totalEstudiantes: 0, totalProfesores: 0, totalPadres: 0, totalCursos: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <p className="text-muted-foreground">Cargando...</p>
    </div>
  );

  return (
    <div className="p-6 sm:p-8 w-full max-w-5xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de Administracion</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona la institucion, usuarios y cursos.</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Estudiantes</p>
              <p className="text-3xl font-bold">{stats.totalEstudiantes}</p>
            </div>
            <GraduationCap className="h-8 w-8 text-blue-500/30" />
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Profesores</p>
              <p className="text-3xl font-bold">{stats.totalProfesores}</p>
            </div>
            <Users className="h-8 w-8 text-emerald-500/30" />
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Padres</p>
              <p className="text-3xl font-bold">{stats.totalPadres}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500/30" />
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-slate-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cursos activos</p>
              <p className="text-3xl font-bold">{stats.totalCursos}</p>
            </div>
            <BookOpen className="h-8 w-8 text-purple-500/30" />
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push("/admin/usuarios")}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Gestionar Usuarios</h3>
              <p className="text-xs text-muted-foreground mt-1">Crear, ver y eliminar estudiantes y profesores</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push("/admin/cursos")}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Gestionar Cursos</h3>
              <p className="text-xs text-muted-foreground mt-1">Crear cursos, asignar profesores y matricular estudiantes</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
