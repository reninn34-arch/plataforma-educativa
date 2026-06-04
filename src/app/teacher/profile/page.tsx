"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, Eye, EyeOff, CheckCircle, Loader2, User, Mail, CreditCard, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";

interface ProfileData { id: number; fullName: string; cedula: string; role: string; email?: string; }

export default function TeacherProfilePage() {
  const router = useRouter();

  const { data: profile, isLoading } = useQuery<ProfileData, Error>({
    queryKey: ["teacher-profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/user/profile");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin || !newPin || newPin.length !== 4) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch("/api/user/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPin, newPin }) });
      const data = await res.json();
      setFeedback({ ok: res.ok, msg: res.ok ? "PIN actualizado correctamente" : data.error });
      if (res.ok) { setCurrentPin(""); setNewPin(""); }
    } catch { setFeedback({ ok: false, msg: "Error de conexión" }); }
    setSaving(false);
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando perfil...</p>
      </div>
    </div>
  );

  const initials = profile?.fullName?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/teacher/dashboard")}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <User size={22} className="text-indigo-500" />
              Mi Perfil
            </h1>
            <p className="text-sm text-slate-400">Información de tu cuenta</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-indigo-200">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">{profile?.fullName}</p>
              <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Docente
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                <CreditCard size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Cédula</span>
              </div>
              <p className="font-semibold text-slate-800">{profile?.cedula || "—"}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                <Mail size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Correo</span>
              </div>
              <p className="font-semibold text-slate-800">{profile?.email || "No registrado"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Lock size={18} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Cambiar PIN</h3>
              <p className="text-xs text-slate-400">Actualiza tu PIN de acceso de 4 dígitos</p>
            </div>
          </div>

          <form onSubmit={handleChangePin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">PIN Actual</label>
              <div className="relative">
                <input type={showPin ? "text" : "password"} value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 pr-11 text-sm font-bold tracking-[0.3em] placeholder:tracking-normal focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="····" />
                <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Nuevo PIN (4 dígitos)</label>
              <input type={showPin ? "text" : "password"} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold tracking-[0.3em] placeholder:tracking-normal focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="····" />
            </div>
            {feedback && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${feedback.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {feedback.ok ? <CheckCircle size={16} /> : <span>⚠️</span>}
                {feedback.msg}
              </div>
            )}
            <Button type="submit" disabled={saving || currentPin.length !== 4 || newPin.length !== 4} className="w-full gap-2 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {saving ? "Actualizando..." : "Actualizar PIN"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
