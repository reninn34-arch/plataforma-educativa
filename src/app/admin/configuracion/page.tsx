"use client";

import { useState } from "react";
import { Save, Loader2, CheckCircle, AlertCircle, Mail, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";

const PROVIDERS: Record<string, { host: string; port: string; label: string; instructions: string }> = {
  gmail: {
    host: "smtp.gmail.com",
    port: "587",
    label: "Gmail / Google Workspace",
    instructions: `1. Activa la verificación en 2 pasos en tu cuenta de Google
2. Ve a https://myaccount.google.com/apppasswords
3. Selecciona "Correo" y "Otro (nombre personalizado)"
4. Pon "Atlas Edu" y copia la contraseña generada (16 caracteres)
5. Pega esa contraseña en el campo "Contraseña SMTP"`,
  },
  outlook: {
    host: "smtp-mail.outlook.com",
    port: "587",
    label: "Outlook / Hotmail / Office 365",
    instructions: `1. Inicia sesión en tu cuenta de Outlook
2. Ve a Configuración > Correo > Sincronizar correo
3. Asegúrate de que SMTP está habilitado
4. Usa tu correo completo como "Usuario SMTP"
5. Usa tu contraseña normal de Outlook`,
  },
  custom: {
    host: "",
    port: "587",
    label: "Servidor SMTP personalizado",
    instructions: `1. Solicita a tu proveedor de hosting los datos SMTP
2. Necesitas: Host, Puerto, Usuario y Contraseña
3. Puerto común: 587 (TLS) o 465 (SSL)
4. Si usas cPanel: los datos están en "Configuración de correo"`,
  },
};

interface ConfigData { smtp_host: string; smtp_port: string; smtp_user: string; smtp_pass: string; smtp_from_name: string; }

function SMTPFormContent({ configData }: { configData: ConfigData }) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState(() => {
    if (!configData.smtp_host) return "gmail";
    for (const [k, v] of Object.entries(PROVIDERS)) {
      if (v.host === configData.smtp_host) return k;
    }
    return "custom";
  });
  const [host, setHost] = useState(configData.smtp_host || "");
  const [port, setPort] = useState(configData.smtp_port || "587");
  const [user, setUser] = useState(configData.smtp_user || "");
  const [pass, setPass] = useState(configData.smtp_pass || "");
  const [fromName, setFromName] = useState(configData.smtp_from_name || "Atlas Edu");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const onProviderChange = (p: string) => {
    setProvider(p);
    const prov = PROVIDERS[p];
    setHost(prov.host);
    setPort(prov.port);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !user) { setError("Host y usuario SMTP son requeridos"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp_host: host, smtp_port: port, smtp_user: user, smtp_pass: pass, smtp_from_name: fromName }),
      });
      if (res.ok) {
        setFeedback("Configuración guardada correctamente.");
        setTimeout(() => setFeedback(""), 3000);
      } else {
        setError("Error al guardar");
      }
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!host || !user) { setTestResult("Configura primero host y usuario"); return; }
    setTesting(true);
    setTestResult("");
    try {
      const res = await apiFetch("/api/admin/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp_host: host, smtp_port: port, smtp_user: user, smtp_pass: pass, smtp_from_name: fromName }),
      });
      const d = await res.json();
      setTestResult(d.success ? "Correo de prueba enviado. Revisa tu bandeja de entrada." : d.error || "Error al enviar");
    } catch { setTestResult("Error de conexión"); }
    setTesting(false);
  };

  const currentInstructions = PROVIDERS[provider].instructions;

  return (
    <div className="p-6 sm:p-8 w-full max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">Configura el envío de correos electrónicos para credenciales</p>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle className="h-4 w-4" /> {feedback}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2"><Mail className="h-4 w-4 text-indigo-500" /> Servidor SMTP</h2>
          </div>
          <div className="p-5">
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Proveedor</label>
                <select value={provider} onChange={e => onProviderChange(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
                  {Object.entries(PROVIDERS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Host SMTP</label>
                  <input type="text" value={host} onChange={e => setHost(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Puerto</label>
                  <input type="text" value={port} onChange={e => setPort(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="587" />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Usuario SMTP (correo)</label>
                <input type="text" value={user} onChange={e => setUser(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="institucion@gmail.com" />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Contraseña SMTP</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="Contraseña de aplicación (Gmail) o contraseña del correo" />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Nombre del remitente</label>
                <input type="text" value={fromName} onChange={e => setFromName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="Atlas Edu" />
              </div>

              {testResult && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${testResult.includes("enviado") ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
                  {testResult}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar configuración
                </Button>
                <Button type="button" variant="outline" disabled={testing} onClick={handleTest} className="rounded-xl border-border gap-2">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
                  Probar conexión
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Instructions */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm h-fit">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-foreground">Cómo configurar {PROVIDERS[provider].label}</h2>
          </div>
          <div className="p-5">
            <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
              {currentInstructions.split("\n").map((line, i) => {
                const withLinks = line.replace(
                  /https?:\/\/[^\s]+/g,
                  (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;text-decoration:underline">${url}</a>`
                );
                return <p key={i} dangerouslySetInnerHTML={{ __html: withLinks }} />;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <SMTPFormContent configData={{ smtp_host: "", smtp_port: "587", smtp_user: "", smtp_pass: "", smtp_from_name: "Atlas Edu" }} />
  );
}
