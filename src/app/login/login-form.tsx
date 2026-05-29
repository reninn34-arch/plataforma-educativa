"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Loader2, Eye, EyeOff, Shield, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

type Props = { redirect?: string };

export function LoginForm({ redirect }: Props) {
  const router = useRouter();
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
        setError(data.error || "Error al iniciar sesion");
        setLoading(false);
        return;
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
      setError("Error de conexion. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const handleForgotPin = async () => {
    if (forgotCedula.length !== 10) {
      setForgotError("Ingresa una cedula valida de 10 digitos");
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
        setForgotMsg(d.message || "Si la cedula existe, recibiras un correo.");
      }
    } catch {
      setForgotError("Error de conexion");
    }
    setForgotLoading(false);
  };

  if (showForgot) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 animate-scale-in">
        <div className="flex flex-col space-y-2 text-center mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary mb-4">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Recuperar PIN
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa tu cedula y te enviaremos un enlace a tu correo.
          </p>
        </div>

        <div className="bg-card border rounded-xl shadow-sm">
          <div className="p-6 sm:p-8 space-y-4">
            {forgotMsg ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                  {forgotMsg}
                </div>
                <Button onClick={() => setShowForgot(false)} variant="outline" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesion
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="forgot-cedula" className="text-sm font-medium">Numero de Cedula</Label>
                  <Input
                    id="forgot-cedula"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Ej. 0999999999"
                    value={forgotCedula}
                    onChange={(e) => setForgotCedula(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="h-11 mt-2"
                    disabled={forgotLoading}
                  />
                </div>

                {forgotError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {forgotError}
                  </div>
                )}

                <Button onClick={handleForgotPin} disabled={forgotLoading || forgotCedula.length !== 10} className="w-full h-11">
                  {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar enlace de recuperacion"}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 py-2"
                >
                  <ArrowLeft className="h-3 w-3" /> Volver al inicio de sesion
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-scale-in">
      <div className="flex flex-col space-y-2 text-center mb-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary mb-4">
          <GraduationCap className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bienvenido a Atlas Edu
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresa tus credenciales para acceder a la plataforma educativa.
        </p>
      </div>

      <div className="bg-card border rounded-xl shadow-sm">
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cedula" className="text-sm font-medium">
                Numero de Cedula
              </Label>
              <Input
                id="cedula"
                aria-label="Cedula"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Ej. 0999999999"
                value={cedula}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setCedula(v);
                }}
                className="h-11"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-sm font-medium">
                PIN de Seguridad (4 digitos)
              </Label>
              <div className="relative">
                <Input
                  id="pin"
                  aria-label="PIN"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPin(v);
                  }}
                  className="h-11 pr-10 tracking-widest"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  aria-label="Mostrar u ocultar PIN"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
                <Shield className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 font-medium"
              disabled={loading || cedula.length !== 10 || pin.length !== 4}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Acceder al portal
            </Button>

            <button
              type="button"
              onClick={() => { setShowForgot(true); setForgotCedula(cedula); setForgotError(""); setForgotMsg(""); }}
              className="w-full text-sm text-primary hover:underline text-center pt-1"
            >
              ¿Olvidaste tu PIN?
            </button>
          </form>
        </div>
        <div className="border-t bg-muted/30 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Acceso restringido a estudiantes y personal autorizado de PCEI.
          </p>
        </div>
      </div>
    </div>
  );
}
