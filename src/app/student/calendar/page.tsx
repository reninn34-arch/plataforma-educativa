"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar as CalendarIcon, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentBottomNav } from "@/components/StudentBottomNav";
import { apiFetch } from "@/lib/fetch-utils";

interface Event {
  id: number;
  title: string;
  subjectName: string;
  subjectEmoji: string;
  dueDate: string;
  status?: string | null;
}

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/student/calendar")
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Group by month
  const grouped = events.reduce((acc, ev) => {
    if (!ev.dueDate) return acc;
    const d = new Date(ev.dueDate);
    const key = d.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {} as Record<string, Event[]>);

  const today = new Date();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4 max-w-2xl mx-auto w-full">
          <Button variant="ghost" size="icon" onClick={() => router.push("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-base font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" /> Calendario
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6 animate-fade-in-up">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Cargando...</p>
        ) : events.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center">
              <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-4 font-medium text-muted-foreground">No tienes tareas con fecha de entrega</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([month, items]) => (
            <div key={month} className="space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{month}</h3>
              {items.map((ev, i) => {
                const dueDate = new Date(ev.dueDate!);
                const isPast = dueDate < today;
                const isSubmitted = ev.status === "submitted" || ev.status === "graded";
                return (
                  <Card key={i} className={`shadow-sm ${isPast && !isSubmitted ? "border-amber-300 bg-amber-50/50" : isSubmitted ? "border-emerald-200 bg-emerald-50/30" : ""}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="text-center min-w-[50px]">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {dueDate.toLocaleDateString("es-EC", { weekday: "short" })}
                        </p>
                        <p className="text-2xl font-extrabold text-foreground tabular-nums">{dueDate.getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span>{ev.subjectEmoji}</span>
                          <Badge variant="secondary" className="text-[10px]">{ev.subjectName}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{ev.title}</p>
                      </div>
                      <div>
                        {isSubmitted ? (
                          <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Entregado</Badge>
                        ) : isPast ? (
                          <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700"><Clock className="h-3 w-3" /> Vencido</Badge>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))
        )}
      </main>
      <StudentBottomNav />
    </div>
  );
}
