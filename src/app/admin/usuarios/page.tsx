"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Pencil, Search, Loader2, X, Copy, Check, UserPlus, Upload, Download, Power, PowerOff, AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface UserData { id: number; cedula: string; fullName: string; role: string; email: string | null; activo: boolean; createdAt: string; subjects?: { subjectId: number; subjectName: string; subjectEmoji: string }[]; }
interface BulkResultItem { cedula: string; nombre: string; pin: string; status: "creado" | "reactivado" | "omitido" | "error"; razon?: string; }

interface UsersData { users: UserData[]; }

export default function AdminUsersPage() {
  const [tab, setTab] = useState<"student" | "teacher" | "parent">("student");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newCedula, setNewCedula] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
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
  const [editResetPin, setEditResetPin] = useState(false);
  const [editError, setEditError] = useState("");

  const [deactivateUser, setDeactivateUser] = useState<UserData | null>(null);
  const [reactivateUser, setReactivateUser] = useState<UserData | null>(null);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<string[][]>([]);
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
    return u.fullName.toLowerCase().includes(s) || u.cedula.includes(s) || (u.email?.toLowerCase().includes(s) ?? false);
  });

  const invalidateUsers = useCallback(() => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); }, [queryClient]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCedula || newCedula.length !== 10 || !newName) return;
    setSaving(true); setError("");
    try {
      const res = await apiFetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cedula: newCedula, fullName: newName, email: newEmail || undefined }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Error al crear usuario"); }
      else {
        const pin = d.pin || d.user?.pin;
        if (pin) { setCreatedPin(pin); setCreatedCedula(newCedula); }
        setShowCreate(false); setNewCedula(""); setNewName(""); setNewEmail(""); invalidateUsers();
        setFeedback("Usuario creado exitosamente"); setTimeout(() => setFeedback(""), 3000);
      }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const startEdit = (u: UserData) => { setEditUser(u); setEditCedula(u.cedula); setEditName(u.fullName); setEditEmail(u.email || ""); setEditResetPin(false); setEditError(""); };
  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true); setEditError("");
    try {
      const res = await apiFetch(`/api/admin/users/${editUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cedula: editCedula, fullName: editName, email: editEmail || undefined, resetPin: editResetPin }) });
      const d = await res.json();
      if (!res.ok) { setEditError(d.error || "Error al actualizar"); }
      else { setEditUser(null); invalidateUsers(); setFeedback("Usuario actualizado"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setEditError("Error de conexion"); }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/users/${deactivateUser.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); }
      else { setDeactivateUser(null); invalidateUsers(); setFeedback("Usuario desactivado"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const handleReactivate = async () => {
    if (!reactivateUser) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/users/${reactivateUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); }
      else { setReactivateUser(null); invalidateUsers(); setFeedback("Usuario reactivado"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setError("Error de conexion"); }
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

  const tabs = [{ key: "student" as const, label: "Estudiantes", count: users.length }, { key: "teacher" as const, label: "Docentes", count: users.length }, { key: "parent" as const, label: "Padres", count: users.length }];

  return (
    <div className="p-6 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestionar Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">{filteredUsers.length} usuarios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)} className="gap-2"><Upload className="h-4 w-4" />Importar CSV</Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2"><UserPlus className="h-4 w-4" />Nuevo Usuario</Button>
        </div>
      </div>

      {feedback && <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">{feedback}</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>}

      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
            Ver inactivos
          </label>
          <Button variant="ghost" size="icon-sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, cedula o email..." className="w-full h-10 rounded-lg border border-input bg-card pl-10 pr-4 text-sm" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filteredUsers.length === 0 ? (
        <Card className="shadow-sm"><CardContent className="py-16 text-center"><p className="text-muted-foreground">No hay usuarios</p></CardContent></Card>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-semibold text-muted-foreground">Nombre</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Cedula</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Email</th>
                <th className="text-left p-3 font-semibold text-muted-foreground">Estado</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium text-foreground">{u.fullName}</td>
                  <td className="p-3 text-muted-foreground">{u.cedula}</td>
                  <td className="p-3 text-muted-foreground">{u.email || "—"}</td>
                  <td className="p-3"><Badge variant={u.activo ? "default" : "secondary"} className="text-[10px]">{u.activo ? "Activo" : "Inactivo"}</Badge></td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => startEdit(u)}><Pencil className="h-4 w-4" /></Button>
                      {u.activo ? <Button variant="ghost" size="icon-sm" className="text-orange-500" onClick={() => setDeactivateUser(u)}><PowerOff className="h-4 w-4" /></Button> : <Button variant="ghost" size="icon-sm" className="text-emerald-500" onClick={() => setReactivateUser(u)}><Power className="h-4 w-4" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-foreground">Nuevo Usuario</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setShowCreate(false); setError(""); setCreatedPin(null); }}><X className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cedula (10 digitos)</label>
                <input value={newCedula} onChange={e => setNewCedula(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" placeholder="1712345678" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nombre completo</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" placeholder="Juan Perez" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email (opcional)</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" placeholder="juan@ejemplo.com" />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button type="submit" disabled={saving || newCedula.length !== 10 || !newName} className="w-full gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Crear Usuario</Button>
            </form>
            {createdPin && (
              <div className="p-4 border-t bg-emerald-50">
                <p className="text-sm font-medium text-emerald-700 mb-2">Usuario creado — PIN generado:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white rounded-lg px-4 py-2 text-lg font-bold text-center">{createdPin}</code>
                  <Button variant="outline" size="icon-sm" onClick={() => copyToClipboard(createdPin)}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                </div>
                <p className="text-xs text-emerald-600 mt-1">Cedula: {createdCedula}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-foreground">Editar Usuario</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditUser(null); setEditError(""); }}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cedula</label>
                <input value={editCedula} onChange={e => setEditCedula(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editResetPin} onChange={e => setEditResetPin(e.target.checked)} className="rounded" />
                Regenerar PIN
              </label>
              {editError && <p className="text-xs text-red-500">{editError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => { setEditUser(null); setEditError(""); }}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {deactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <h2 className="font-bold text-foreground mb-2">Desactivar Usuario</h2>
            <p className="text-sm text-muted-foreground mb-6">Seguro que deseas desactivar a <strong>{deactivateUser.fullName}</strong>?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeactivateUser(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeactivate} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}Desactivar</Button>
            </div>
          </div>
        </div>
      )}

      {reactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <h2 className="font-bold text-foreground mb-2">Reactivar Usuario</h2>
            <p className="text-sm text-muted-foreground mb-6">Reactivar a <strong>{reactivateUser.fullName}</strong>?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReactivateUser(null)}>Cancelar</Button>
              <Button onClick={handleReactivate} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}Reactivar</Button>
            </div>
          </div>
        </div>
      )}

      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">Importar CSV</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setShowBulkImport(false); setBulkResults(null); setBulkFile(null); }}><X className="h-4 w-4" /></Button>
            </div>
            {!bulkResults ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">Sube un archivo CSV con columnas: cedula, nombre, email (opcional)</p>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={e => setBulkFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                {bulkFile && <Button onClick={handleBulkImport} disabled={bulkImporting} className="mt-4 w-full gap-2">{bulkImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Importar</Button>}
              </>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bulkResults.map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${r.status === "creado" || r.status === "reactivado" ? "bg-emerald-50 border-emerald-200" : r.status === "error" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{r.nombre}</span>
                      <Badge variant={r.status === "creado" || r.status === "reactivado" ? "default" : r.status === "error" ? "destructive" : "secondary"} className="text-[10px]">{r.status}</Badge>
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
    </div>
  );
}