"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight, ArrowLeft, ClipboardList, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DueTimer } from "@/components/DueTimer";
import { apiFetch } from "@/lib/fetch-utils";

type Tab = "pending" | "expired" | "submitted";

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("pending");

  useEffect(() => {
    apiFetch("/api/assignments?role=student")
      .then(r => r.json())
      .then(d => { if (d.assignments) setAssignments(d.assignments); })
      .catch(() => {});
  }, []);

  const now = Date.now();

  const pending = assignments.filter((a: any) =>
    a.status !== "graded" && a.status !== "submitted" &&
    (!a.dueDate || new Date(a.dueDate).getTime() > now)
  );

  const expired = assignments.filter((a: any) =>
    a.status !== "graded" && a.status !== "submitted" &&
    a.dueDate && new Date(a.dueDate).getTime() <= now
  );

  const submitted = assignments.filter((a: any) =>
    a.status === "submitted" || a.status === "graded"
  );

  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "pending", label: "Pendientes", count: pending.length, icon: <AlertCircle className="h-4 w-4 text-amber-500" /> },
    { key: "expired", label: "Vencidas", count: expired.length, icon: <Clock className="h-4 w-4 text-slate-400" /> },
    { key: "submitted", label: "Entregadas", count: submitted.length, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
  ];

  const currentList = activeTab === "pending" ? pending : activeTab === "expired" ? expired : submitted;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4 max-w-4xl mx-auto w-full">
          <Link href="/student/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-foreground">Mis Tareas</h1>
            <p className="text-xs text-muted-foreground">{assignments.length} tareas asignadas</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full space-y-6 animate-fade-in-up">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                activeTab === tab.key ? "bg-muted text-foreground" : "bg-muted/50 text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        {currentList.length > 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="divide-y">
                {currentList.map((a: any) => (
                  <Link
                    key={a.id}
                    href={`/student/assignments/${a.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-lg ${
                        activeTab === "expired" ? "bg-slate-100 text-slate-400" :
                        activeTab === "submitted" ? "bg-emerald-100 text-emerald-600" :
                        "bg-amber-100 text-amber-600"
                      }`}>
                        {activeTab === "expired" ? "❌" :
                         activeTab === "submitted" ? "✅" :
                         a.subjectEmoji}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.subjectName}
                          {a.cursoNombre && ` · ${a.cursoNombre}`}
                          {a.teacherName && ` · ${a.teacherName}`}
                        </p>
                        {a.dueDate && (
                          <div className="mt-1">
                            <DueTimer dueDate={a.dueDate} compact />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(a.status === "graded" || a.grade != null) && (
                        <Badge variant={a.grade >= 7 ? "default" : "destructive"} className="text-[10px]">
                          {a.grade}/10
                        </Badge>
                      )}
                      {a.status === "submitted" && a.grade == null && (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          Sin calificar
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-12 text-center space-y-2">
              <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                No hay tareas {activeTab === "pending" ? "pendientes" : activeTab === "expired" ? "vencidas" : "entregadas"}.
              </p>
              <p className="text-xs text-muted-foreground/70">
                {activeTab === "pending" ? "Tus tareas activas apareceran aqui." :
                 activeTab === "expired" ? "Las tareas vencidas se muestran aqui." :
                 "Las tareas que entregues apareceran aqui."}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
