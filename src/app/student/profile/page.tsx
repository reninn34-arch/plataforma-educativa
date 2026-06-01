"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, Eye, EyeOff, CheckCircle, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentBottomNav } from "@/components/StudentBottomNav";
import { apiFetch } from "@/lib/fetch-utils";

interface ProfileData { id: number; fullName: string; cedula: string; role: string; email?: string; }

export default function ProfilePage() {
  const router = useRouter();

  const { data: profile, isLoading } = useQuery<ProfileData, Error>({
    queryKey: ["student-profile"],
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
      const res = await apiFetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      setFeedback({ ok: res.ok, msg: res.ok ? "PIN actualizado correctamente" : data.error });
      if (res.ok) { setCurrentPin(""); setNewPin(""); }
    } catch { setFeedback({ ok: false, msg: "Error de conexion" }); }
    setSaving(false);
  };

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4 max-w-2xl mx-auto w-full">
          <Button variant="ghost" size="icon" onClick={() => router.push("/student/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-base font-bold text-foreground flex items-center gap-2">
            <User className="h-5 w-5" /> Mi Perfil
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6 animate-fade-in-up">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Datos de la Cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                {profile?.fullName?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-foreground">{profile?.fullName}</p>
                <p className="text-sm text-muted-foreground">Estudiante</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cedula</p>
                <p className="font-medium text-foreground">{profile?.cedula || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Correo</p>
                <p className="font-medium text-foreground">{profile?.email || "No registrado"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Cambiar PIN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePin} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">PIN Actual</label>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 pr-10 text-sm"
                    placeholder="••••"
                  />
                  <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nuevo PIN (4 digitos)</label>
                <input
                  type={showPin ? "text" : "password"}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm"
                  placeholder="••••"
                />
              </div>
              {feedback && (
                <div className={`flex items-center gap-2 text-sm ${feedback.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {feedback.ok ? <CheckCircle className="h-4 w-4" /> : <span>⚠️</span>}
                  {feedback.msg}
                </div>
              )}
              <Button type="submit" disabled={saving || currentPin.length !== 4 || newPin.length !== 4} className="w-full gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Actualizar PIN
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          <p>Atlas Edu — PCEI 2024</p>
        </div>
      </main>
      <StudentBottomNav />
    </div>
  );
}