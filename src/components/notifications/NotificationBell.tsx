"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

interface Notificacion {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  relatedId: number | null;
  createdAt: string;
}

interface NotificacionesResponse {
  notificaciones: Notificacion[];
  unreadCount: number;
}

const typeIcons: Record<string, string> = {
  assignment: "📝",
  message: "💬",
  deadline: "⏰",
  grade: "📊",
  system: "🔔",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data, isLoading } = useQuery<NotificacionesResponse, Error>({
    queryKey: ["notificaciones"],
    queryFn: async () => {
      const res = await apiFetch("/api/notificaciones");
      if (!res.ok) throw new Error("Error al cargar notificaciones");
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/notificaciones/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error("Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
    },
  });

  const notificaciones = data?.notificaciones || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                {markAllRead.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCheck className="h-3 w-3" />
                )}
                Marcar todas leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            )}

            {!isLoading && notificaciones.length === 0 && (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No hay notificaciones</p>
              </div>
            )}

            {!isLoading && notificaciones.map((n) => {
              const content = (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    !n.read ? "bg-indigo-50/50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base shrink-0 mt-0.5">
                    {typeIcons[n.type] || typeIcons.system}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${!n.read ? "font-bold text-slate-800" : "font-medium text-slate-600"}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-[10px] text-slate-300 mt-1">
                      {new Date(n.createdAt).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                  )}
                </div>
              );

              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
