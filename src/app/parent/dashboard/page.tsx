"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, Users } from "lucide-react";
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
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando panel...</p>
      </div>
    </div>
  );

  const profile = data?.profile;
  const children = data?.children || [];

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-8">
        {/* Hero */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-3">
              <Sparkles size={12} />
              Portal de Representante
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              ¡Hola, {profile?.fullName?.split(" ")[0] || "Representante"}! 👋
            </h1>
            <p className="text-indigo-200 mt-2 max-w-lg">
              Monitorea el progreso académico de tus representados.
            </p>
          </div>
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-300" />
            </div>
            <p className="font-semibold text-slate-600">No tienes estudiantes vinculados</p>
            <p className="text-sm text-slate-400 mt-1">Contacta al administrador para vincular tu cuenta</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {children.map((child: any) => (
              <div key={child.studentId} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-indigo-200">
                    {child.studentName?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800">{child.studentName}</p>
                    <p className="text-sm text-slate-400">{child.studentCedula}</p>
                  </div>
                </div>

                {child.cursos && child.cursos.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cursos</p>
                    <div className="space-y-2">
                      {child.cursos.map((c: any) => {
                        const pct = c.progress || 0;
                        return (
                          <div key={c.cursoId} className="bg-slate-50 rounded-xl p-3">
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="font-semibold text-slate-700">{c.cursoNombre}</span>
                              <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50">{pct}%</Badge>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {child.grades && child.grades.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Notas recientes</p>
                    <div className="flex flex-wrap gap-2">
                      {child.grades.map((g: any, i: number) => (
                        <Badge key={i} className={`text-xs gap-1 border ${
                          g.value >= 7
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          <span>{g.emoji}</span> {g.value?.toFixed(1) || "—"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
