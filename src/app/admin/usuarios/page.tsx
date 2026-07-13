"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Pencil, Search, Loader2, X, Copy, Check, UserPlus, Upload, Power, PowerOff, AlertTriangle, ShieldCheck, GraduationCap, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface UserData { id: number; cedula: string; fullName: string; role: string; email: string | null; whatsapp: string | null; activo: boolean; createdAt: string; subjects?: { subjectId: number; subjectName: string; subjectEmoji: string }[]; }
interface BulkResultItem { cedula: string; nombre: string; pin: string; status: "creado" | "reactivado" | "omitido" | "error"; razon?: string; }
interface UsersData { users: UserData[]; }

export default function AdminUsersPage() {
  const [tab, setTab] = useState<"student" | "teacher">("student");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newCedula, setNewCedula] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [createdCedula, setCreatedCedula] = useState("");
  const [copied, setCopied] = useState(false);

  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editCedula, setEditCedula] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editResetPin, setEditResetPin] = useState(false);
  const [editError, setEditError] = useState("");
  const [sendingCreds, setSendingCreds] = useState(false);
  const [credsFeedback, setCredsFeedback] = useState("");

  const [deactivateUser, setDeactivateUser] = useState<UserData | null>(null);
  const [reactivateUser, setReactivateUser] = useState<UserData | null>(null);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResultItem[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ role: tab });
    if (showInactive) params.set("inactivos", "true");
    return params.toString();
  }, [tab, showInactive]);

  const { data, isLoading, refetch } = useQuery<UsersData, Error>({
    queryKey: ["admin-users", tab, showInactive],
    queryFn: async () => {
      const params = buildParams();
      const res = await apiFetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const users = data?.users || [];

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.fullName.toLowerCase().includes(s) || u.cedula.includes(s) || (u.email?.toLowerCase().includes(s) ?? false) || (u.whatsapp?.toLowerCase().includes(s) ?? false);
  });

  const invalidateUsers = useCallback(() => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); }, [queryClient]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCedula || newCedula.length !== 10 || !newName) return;
    setSaving(true); setError("");
    try {
      const res = await apiFetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cedula: newCedula, fullName: newName, role: tab, email: newEmail || null, whatsapp: newWhatsapp || null }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Error al crear usuario"); }
      else {
        const pin = d.pin || d.user?.pin;
        if (pin) { setCreatedPin(pin); setCreatedCedula(newCedula); }
        setShowCreate(false); setNewCedula(""); setNewName(""); setNewEmail(""); setNewWhatsapp(""); invalidateUsers();
        setFeedback("Usuario creado exitosamente"); setTimeout(() => setFeedback(""), 3000);
      }
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  const handleSendCredentials = async () => {
    if (!editUser) return;
    setSendingCreds(true); setCredsFeedback("");
    try {
      const res = await apiFetch(`/api/admin/users/${editUser.id}/send-credentials`, { method: "POST" });
      const d = await res.json();
      setCredsFeedback(res.ok ? "Credenciales enviadas por correo" : d.error || "Error");
    } catch { setCredsFeedback("Error de conexión"); }
    setSendingCreds(false);
    setTimeout(() => setCredsFeedback(""), 4000);
  };

  const startEdit = (u: UserData) => { setEditUser(u); setEditCedula(u.cedula); setEditName(u.fullName); setEditEmail(u.email || ""); setEditWhatsapp(u.whatsapp || ""); setEditResetPin(false); setEditError(""); };
  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true); setEditError("");
    try {
      const res = await apiFetch(`/api/admin/users/${editUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cedula: editCedula, fullName: editName, email: editEmail || null, whatsapp: editWhatsapp || null, resetPin: editResetPin }) });
      const d = await res.json();
      if (!res.ok) { setEditError(d.error || "Error al actualizar"); }
      else {
        if (d.newPin) { setCreatedPin(d.newPin); setCreatedCedula(editCedula); }
        setEditUser(null); invalidateUsers(); setFeedback("Usuario actualizado"); setTimeout(() => setFeedback(""), 3000);
      }
    } catch { setEditError("Error de conexión"); }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/users/${deactivateUser.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); }
      else { setDeactivateUser(null); invalidateUsers(); setFeedback("Usuario desactivado"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  const handleReactivate = async () => {
    if (!reactivateUser) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/users/${reactivateUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); }
      else { setReactivateUser(null); invalidateUsers(); setFeedback("Usuario reactivado"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  const handleBulkImport = async () => {
    if (!bulkFile) return;
    setBulkImporting(true);
    const formData = new FormData();
    formData.append("file", bulkFile);
    try {
      const res = await apiFetch("/api/admin/users/bulk", { method: "POST", body: formData });
      const d = await res.json();
      if (d.resultados) setBulkResults(d.resultados);
      else if (d.error) setError(d.error);
      invalidateUsers();
    } catch { setError("Error al importar"); }
    setBulkImporting(false);
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const tabs = [{ key: "student" as const, label: "Estudiantes", count: users.length }, { key: "teacher" as const, label: "Docentes", count: users.length }];

  return (
    <div className="p-6 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestionar Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">{filteredUsers.length} usuarios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)} className="gap-2 rounded-xl border-border"><Upload className="h-4 w-4" />Importar CSV</Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"><UserPlus className="h-4 w-4" />Nuevo Usuario</Button>
        </div>
      </div>

      {feedback && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 flex items-center gap-2"><Check className="h-4 w-4" />{feedback}</div>}
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>}

      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded border-border text-indigo-600 focus:ring-indigo-300" />
            Ver inactivos
          </label>
          <Button variant="ghost" size="icon-sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 text-muted-foreground" /></Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, cédula o email..." className="w-full h-10 rounded-xl border border-border bg-card pl-10 pr-4 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border py-16 text-center shadow-sm">
          <GraduationCap className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 font-medium text-muted-foreground">No hay usuarios</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-muted/50">
                <th className="text-left p-3 font-semibold text-muted-foreground">Nombre</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Cédula</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Email</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">WhatsApp</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Estado</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/30 transition-colors">
                  <td className="p-3 font-medium text-foreground">{u.fullName}</td>
                  <td className="p-3 text-muted-foreground">{u.cedula}</td>
                  <td className="p-3 text-muted-foreground">{u.email || "—"}</td>
                  <td className="p-3">{u.whatsapp ? <a href={`https://wa.me/${u.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">+{u.whatsapp}</a> : "—"}</td>
                  <td className="p-3"><Badge variant={u.activo ? "default" : "secondary"} className="text-[10px] rounded-lg">{u.activo ? "Activo" : "Inactivo"}</Badge></td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => startEdit(u)} className="text-slate-400 hover:text-indigo-600"><Pencil className="h-4 w-4" /></Button>
                      {u.activo ? <Button variant="ghost" size="icon-sm" className="text-amber-500" onClick={() => setDeactivateUser(u)}><PowerOff className="h-4 w-4" /></Button> : <Button variant="ghost" size="icon-sm" className="text-emerald-500" onClick={() => setReactivateUser(u)}><Power className="h-4 w-4" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-foreground">Nuevo Usuario</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setShowCreate(false); setError(""); setCreatedPin(null); }} className="text-slate-400 hover:text-muted-foreground"><X className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Cédula (10 dígitos)</label>
                <input value={newCedula} onChange={e => setNewCedula(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="1712345678" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nombre completo</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email (opcional)</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="juan@ejemplo.com" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">WhatsApp (opcional, ej: 593999999999)</label>
                <input value={newWhatsapp} onChange={e => setNewWhatsapp(e.target.value.replace(/\D/g, ""))} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="593999999999" />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button type="submit" disabled={saving || newCedula.length !== 10 || !newName} className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Crear Usuario</Button>
            </form>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-foreground">Editar Usuario</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditUser(null); setEditError(""); }} className="text-slate-400 hover:text-muted-foreground"><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Cédula</label>
                <input value={editCedula} onChange={e => setEditCedula(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nombre</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">WhatsApp</label>
                <input value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value.replace(/\D/g, ""))} className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="593999999999" />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={editResetPin} onChange={e => setEditResetPin(e.target.checked)} className="rounded border-border text-indigo-600 focus:ring-indigo-300" />
                Regenerar PIN
              </label>
              {editError && <p className="text-xs text-red-500">{editError}</p>}
              {editUser?.email && (
                <>
                  {credsFeedback && <p className={`text-xs ${credsFeedback.includes("Error") ? "text-red-500" : "text-emerald-600"}`}>{credsFeedback}</p>}
                  <Button variant="outline" onClick={handleSendCredentials} disabled={sendingCreds} className="w-full rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-2">
                    {sendingCreds ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sendingCreds ? "Enviando..." : "Enviar credenciales por correo"}
                  </Button>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setEditUser(null); setEditError(""); }} className="rounded-xl border-border">Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {deactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-md mx-4 p-6">
            <h2 className="font-bold text-foreground mb-2">Desactivar Usuario</h2>
            <p className="text-sm text-muted-foreground mb-6">¿Seguro que deseas desactivar a <strong className="text-foreground">{deactivateUser.fullName}</strong>?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeactivateUser(null)} className="rounded-xl border-border">Cancelar</Button>
              <Button variant="destructive" onClick={handleDeactivate} disabled={saving} className="rounded-xl gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}Desactivar</Button>
            </div>
          </div>
        </div>
      )}

      {reactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-md mx-4 p-6">
            <h2 className="font-bold text-foreground mb-2">Reactivar Usuario</h2>
            <p className="text-sm text-muted-foreground mb-6">¿Reactivar a <strong className="text-foreground">{reactivateUser.fullName}</strong>?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReactivateUser(null)} className="rounded-xl border-border">Cancelar</Button>
              <Button onClick={handleReactivate} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}Reactivar</Button>
            </div>
          </div>
        </div>
      )}

      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">Importar CSV</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setShowBulkImport(false); setBulkResults(null); setBulkFile(null); }} className="text-slate-400 hover:text-muted-foreground"><X className="h-4 w-4" /></Button>
            </div>
            {!bulkResults ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">Sube un archivo CSV con columnas: cedula, nombre, email (opcional)</p>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={e => setBulkFile(e.target.files?.[0] || null)} className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                {bulkFile && <Button onClick={handleBulkImport} disabled={bulkImporting} className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">{bulkImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Importar</Button>}
              </>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bulkResults.map((r, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${r.status === "creado" || r.status === "reactivado" ? "bg-emerald-50 border-emerald-200" : r.status === "error" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground">{r.nombre}</span>
                      <Badge variant={r.status === "creado" || r.status === "reactivado" ? "default" : r.status === "error" ? "destructive" : "secondary"} className="text-[10px] rounded-lg">{r.status}</Badge>
                    </div>
                    {r.pin && <p className="text-xs text-muted-foreground mt-1">PIN: {r.pin}</p>}
                    {r.razon && <p className="text-xs text-red-500 mt-1">{r.razon}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {createdPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-foreground">PIN de Acceso Generado</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setCreatedPin(null)} className="text-slate-400 hover:text-muted-foreground"><X className="h-4 w-4" /></Button>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4 text-center space-y-3">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Cédula / Usuario: {createdCedula}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-card rounded-xl px-4 py-2 text-xl font-bold tracking-widest text-center border border-indigo-200">{createdPin}</code>
                <Button variant="outline" size="icon-sm" onClick={() => copyToClipboard(createdPin)} className="border-border">{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}</Button>
              </div>
              <p className="text-[11px] text-indigo-600">Por favor, entrega este PIN de 4 dígitos al usuario. No se volverá a mostrar.</p>
            </div>
            <Button onClick={() => setCreatedPin(null)} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200">Listo, cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
