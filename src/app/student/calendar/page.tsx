"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar as CalendarIcon, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentBottomNav } from "@/components/StudentBottomNav";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

interface Event {
  id: number;
  title: string;
  subjectName: string;
  subjectEmoji: string;
  dueDate: string;
  status?: string | null;
}

interface CalendarData {
  events: Event[];
}

export default function CalendarPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery<CalendarData, Error>({
    queryKey: ["student-calendar"],
    queryFn: async () => {
      const res = await apiFetch("/api/student/calendar");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
  });

  const events = data?.events || [];
  const grouped = events.reduce((acc, ev) => {
    if (!ev.dueDate) return acc;
    const d = new Date(ev.dueDate);
    const key = d.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {} as Record<string, Event[]>);

  const today = new Date();

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando calendario...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/student/dashboard")}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarIcon size={22} className="text-indigo-500" />
              Calendario
            </h1>
            <p className="text-sm text-slate-400">Fechas de entrega de tareas</p>
          </div>
        </div>

        {events.length === 0 ? (
          <Card className="shadow-sm border-slate-200">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <CalendarIcon size={32} className="text-slate-300" />
              </div>
              <p className="font-semibold text-slate-600">No tienes tareas con fecha de entrega</p>
              <p className="text-sm text-slate-400 mt-1">Tu calendario está limpio</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([month, items]) => (
            <div key={month} className="space-y-3">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <CalendarIcon size={14} />
                {month.charAt(0).toUpperCase() + month.slice(1)}
              </h3>
              <div className="space-y-3">
                {items.map((ev, i) => {
                  const dueDate = new Date(ev.dueDate!);
                  const isPast = dueDate < today;
                  const isSubmitted = ev.status === "submitted" || ev.status === "graded";
                  const theme = ev.subjectName ? subjectTheme(ev.subjectName.toLowerCase()) : null;

                  return (
                    <div
                      key={i}
                      className={`bg-white rounded-2xl border-2 p-4 transition-all ${
                        isPast && !isSubmitted
                          ? "border-red-200 bg-red-50/30"
                          : isSubmitted
                          ? "border-emerald-200 bg-emerald-50/30"
                          : "border-slate-200 hover:shadow-md hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[56px]">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">
                            {dueDate.toLocaleDateString("es-EC", { weekday: "short" })}
                          </p>
                          <p className="text-2xl font-extrabold text-slate-800 tabular-nums -mt-0.5">
                            {dueDate.getDate()}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg">{ev.subjectEmoji}</span>
                            <span className={`text-xs font-semibold ${theme?.text || "text-slate-600"}`}>
                              {ev.subjectName}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-700 mt-0.5">{ev.title}</p>
                        </div>
                        <div className="shrink-0">
                          {isSubmitted ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                              <CheckCircle size={12} /> Entregado
                            </Badge>
                          ) : isPast ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                              <AlertCircle size={12} /> Vencido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50">
                              Pendiente
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <StudentBottomNav />
    </div>
  );
}
