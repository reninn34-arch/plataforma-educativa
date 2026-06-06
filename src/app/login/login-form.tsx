"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff, Shield, ArrowLeft, Sparkles, GraduationCap } from "lucide-react";
import { apiFetch, clearCache } from "@/lib/fetch-utils";

type Props = { redirect?: string };

export function LoginForm({ redirect }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  const [cedula, setCedula] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotCedula, setForgotCedula] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotError, setForgotError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: cedula.trim(), pin: pin.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        setLoading(false);
        return;
      }

      queryClient.clear();
      clearCache();
      if (data.user.themePreference) {
        const resolved = data.user.themePreference === "dark" ? "dark" : "light";
        localStorage.setItem("theme", resolved);
        setTheme(resolved);
      }
      const safeRedirect = redirect && redirect.startsWith("/") ? redirect : null;
      if (data.user.role === "teacher") {
        router.push("/teacher/dashboard");
      } else if (data.user.role === "admin") {
        router.push("/admin/dashboard");
      } else if (data.user.role === "parent") {
        router.push("/parent/dashboard");
      } else {
        router.push(safeRedirect || "/student/dashboard");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const handleForgotPin = async () => {
    if (forgotCedula.length !== 10) {
      setForgotError("Ingresa una cédula válida de 10 dígitos");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    setForgotMsg("");
    try {
      const res = await apiFetch("/api/auth/forgot-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: forgotCedula }),
      });
      const d = await res.json();
      if (!res.ok) {
        setForgotError(d.error || "Error al enviar");
      } else {
        setForgotMsg(d.message || "Si la cédula existe, recibirás un correo.");
      }
    } catch {
      setForgotError("Error de conexión");
    }
    setForgotLoading(false);
  };

  if (showForgot) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in-up">
        <div className="bg-card rounded-3xl border border-border shadow-xl shadow-indigo-200/20 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-card/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 border border-white/20">
              <GraduationCap size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Recuperar PIN</h1>
            <p className="text-indigo-200 text-sm mt-1">Ingresa tu cédula y te enviaremos instrucciones</p>
          </div>

          <div className="p-6 sm:p-8">
            {forgotMsg ? (
              <div className="space-y-4 animate-fade-in-up">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-4 text-sm text-emerald-700 flex items-start gap-3">
                  <span className="text-lg">📧</span>
                  <span>{forgotMsg}</span>
                </div>
                <Button onClick={() => setShowForgot(false)} variant="outline" className="w-full h-11 rounded-xl border-border">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Volver al inicio
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground block mb-1.5">Número de Cédula</label>
                  <input
                    id="forgot-cedula"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Ej. 0999999999"
                    value={forgotCedula}
                    onChange={(e) => setForgotCedula(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                    disabled={forgotLoading}
                  />
                </div>

                {forgotError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <Shield size={14} />
                    {forgotError}
                  </div>
                )}

                <Button onClick={handleForgotPin} disabled={forgotLoading || forgotCedula.length !== 10} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200">
                  {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar enlace de recuperación"}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full text-sm text-slate-400 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1 py-2"
                >
                  <ArrowLeft className="h-3 w-3" /> Volver al inicio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in-up">
      {/* Logo + Branding */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-200">
          <GraduationCap size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
          Atlas Edu
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Plataforma Educativa PCEI
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-card rounded-3xl border border-border shadow-xl shadow-indigo-200/20 overflow-hidden">
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="cedula" className="text-sm font-semibold text-foreground">
                Número de Cédula
              </label>
              <input
                id="cedula"
                aria-label="Cédula"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Ej. 0999999999"
                value={cedula}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setCedula(v);
                }}
                className="w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pin" className="text-sm font-semibold text-foreground">
                PIN de Seguridad (4 dígitos)
              </label>
              <div className="relative">
                <input
                  id="pin"
                  aria-label="PIN"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="····"
                  value={pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPin(v);
                  }}
                  className="w-full h-11 rounded-xl border border-border bg-card px-4 pr-11 text-sm font-bold tracking-[0.3em] placeholder:tracking-normal focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  aria-label="Mostrar u ocultar PIN"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <Shield size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-200 disabled:opacity-50"
              disabled={loading || cedula.length !== 10 || pin.length !== 4}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Acceder al portal
            </Button>

            <button
              type="button"
              onClick={() => { setShowForgot(true); setForgotCedula(cedula); setForgotError(""); setForgotMsg(""); }}
              className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium text-center pt-1 hover:underline transition-colors"
            >
              ¿Olvidaste tu PIN?
            </button>
          </form>
        </div>
        <div className="border-t border-slate-100 bg-muted/50 p-4 text-center">
          <p className="text-xs text-slate-400">
            Acceso restringido a estudiantes y personal autorizado de PCEI.
          </p>
        </div>
      </div>
    </div>
  );
}
