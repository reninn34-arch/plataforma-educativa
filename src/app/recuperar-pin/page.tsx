"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function RecuperarPinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      setError("El PIN debe tener 4 digitos");
      return;
    }
    if (newPin !== confirmPin) {
      setError("Los PINs no coinciden");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPin }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Error al restablecer PIN");
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Error de conexion");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-sm w-full shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">Enlace invalido o faltante.</p>
            <Button onClick={() => router.push("/login")} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-sm w-full shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="text-xl font-bold text-foreground">PIN actualizado</h2>
            <p className="text-sm text-muted-foreground">Tu nuevo PIN ha sido guardado. Ya puedes iniciar sesion.</p>
            <Button onClick={() => router.push("/login")} className="w-full">
              Ir al inicio de sesion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-sm w-full shadow-lg">
        <CardContent className="p-8 space-y-6">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <span className="text-2xl">🔐</span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">Nuevo PIN</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ingresa tu nuevo PIN de 4 digitos</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Nuevo PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full h-12 rounded-lg border border-input bg-card px-4 text-center text-2xl tracking-[0.5em]"
                placeholder="••••"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Confirmar PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full h-12 rounded-lg border border-input bg-card px-4 text-center text-2xl tracking-[0.5em]"
                placeholder="••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading || newPin.length < 4} className="w-full h-11">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Guardar nuevo PIN"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RecuperarPinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <RecuperarPinContent />
    </Suspense>
  );
}
