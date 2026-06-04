"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ArrowLeft, ClipboardList, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DueTimer } from "@/components/DueTimer";
import { apiFetch } from "@/lib/fetch-utils";
import { subjectTheme } from "@/lib/subject-theme";

type Tab = "pending" | "expired" | "submitted";

interface AssignmentsData { assignments: any[]; }

export default function StudentAssignmentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pending");

  const { data, isLoading } = useQuery<AssignmentsData, Error>({
    queryKey: ["student-assignments"],
    queryFn: async () => {
      const res = await apiFetch("/api/assignments?role=student");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const assignments = data?.assignments || [];
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

  const tabs: { key: Tab; label: string; count: number; color: string; bgColor: string }[] = [
    { key: "pending", label: "Pendientes", count: pending.length, color: "text-amber-600", bgColor: "bg-amber-50" },
    { key: "expired", label: "Vencidas", count: expired.length, color: "text-red-600", bgColor: "bg-red-50" },
    { key: "submitted", label: "Entregadas", count: submitted.length, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  ];

  const currentList = activeTab === "pending" ? pending : activeTab === "expired" ? expired : submitted;

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando tareas...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/student/dashboard"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Mis Tareas</h1>
            <p className="text-sm text-slate-400">{assignments.length} tareas asignadas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === tab.key ? tab.color : "bg-slate-300"}`} />
              {tab.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? `${tab.bgColor} ${tab.color}`
                  : "bg-slate-100 text-slate-400"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        {currentList.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
            {currentList.map((a: any) => {
              const subjectSlug = a.subjectName?.toLowerCase() || "";
              const theme = subjectTheme(subjectSlug);
              return (
                <Link
                  key={a.id}
                  href={`/student/assignments/${a.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${theme.bgLight} flex items-center justify-center text-lg shrink-0`}>
                      {a.subjectEmoji || "📋"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                        {a.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.subjectName}{a.cursoNombre && ` · ${a.cursoNombre}`}
                      </p>
                      {a.dueDate && (
                        <div className="mt-1.5">
                          <DueTimer dueDate={a.dueDate} compact />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {(a.status === "graded" || a.grade != null) && (
                      <Badge className={`text-[10px] border ${a.grade >= 7 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {a.grade}/10
                      </Badge>
                    )}
                    {a.status === "submitted" && a.grade == null && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        Sin calificar
                      </Badge>
                    )}
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="shadow-sm border-slate-200">
            <CardContent className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto">
                {activeTab === "submitted" ? (
                  <CheckCircle2 size={32} className="text-slate-300" />
                ) : (
                  <ClipboardList size={32} className="text-slate-300" />
                )}
              </div>
              <p className="font-semibold text-slate-600">
                No hay tareas {activeTab === "pending" ? "pendientes" : activeTab === "expired" ? "vencidas" : "entregadas"}
              </p>
              <p className="text-sm text-slate-400">
                {activeTab === "pending" ? "¡Todo al día!" : activeTab === "expired" ? "Todo en orden" : "Aún no has entregado ninguna"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
