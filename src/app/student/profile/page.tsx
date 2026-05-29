"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, Eye, EyeOff, CheckCircle, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentBottomNav } from "@/components/StudentBottomNav";
import { apiFetch } from "@/lib/fetch-utils";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ cedula: string; fullName: string; role: string } | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/user/profile")
      .then(r => r.json())
      .then(d => setProfile(d))
      .catch(() => {});
  }, []);

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
    } catch {
      setFeedback({ ok: false, msg: "Error de conexion" });
    }
    setSaving(false);
  };

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
        {/* Profile Info */}
        <Card className="shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">
                {profile?.fullName?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{profile?.fullName}</h2>
                <p className="text-sm text-muted-foreground">Cedula: {profile?.cedula}</p>
                <Badge variant={profile?.role === "student" ? "secondary" : "default"} className="mt-1 text-[10px]">
                  {profile?.role === "student" ? "Estudiante" : "Docente"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change PIN */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Cambiar PIN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePin} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">PIN actual</label>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={4}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="w-full h-12 rounded-lg border border-input bg-card px-4 text-center text-lg tracking-[0.5em] font-mono pr-12"
                  />
                  <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Nuevo PIN (4 digitos)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="w-full h-12 rounded-lg border border-input bg-card px-4 text-center text-lg tracking-[0.5em] font-mono"
                />
              </div>

              {feedback && (
                <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${feedback.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {feedback.ok ? <CheckCircle className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  {feedback.msg}
                </div>
              )}

              <Button type="submit" disabled={saving || currentPin.length !== 4 || newPin.length !== 4} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Guardando..." : "Actualizar PIN"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <StudentBottomNav />
    </div>
  );
}
