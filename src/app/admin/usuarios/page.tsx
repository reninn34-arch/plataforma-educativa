"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCw, Pencil, Search, Loader2, X, Copy, Check, UserPlus,
  Upload, Download, Power, PowerOff, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface UserData {
  id: number;
  cedula: string;
  fullName: string;
  role: string;
  email: string | null;
  activo: boolean;
  createdAt: string;
  subjects?: { subjectId: number; subjectName: string; subjectEmoji: string }[];
}

interface BulkResultItem {
  cedula: string;
  nombre: string;
  pin: string;
  status: "creado" | "reactivado" | "omitido" | "error";
  razon?: string;
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<"student" | "teacher">("student");
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role: tab });
      if (showInactive) params.set("inactivos", "true");
      const res = await fetch(`/api/admin/users?${params}`);
      const d = await res.json();
      setUsers(d.users || []);
    } catch {}
    setLoading(false);
  }, [tab, showInactive]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCedula || newCedula.length !== 10 || !newName) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: newCedula, fullName: newName, role: tab, email: newEmail || null }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); setSaving(false); return; }

      setCreatedPin(d.pin);
      setFeedback(`Usuario ${newName} creado.`);
      fetchUsers();
      resetForm();
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const confirmDeactivate = (u: UserData) => {
    setDeactivateUser(u);
  };

  const doDeactivate = async () => {
    if (!deactivateUser) return;
    try {
      await fetch(`/api/admin/users/${deactivateUser.id}`, { method: "DELETE" });
      setFeedback(`Usuario ${deactivateUser.fullName} desactivado.`);
      fetchUsers();
    } catch {}
    setDeactivateUser(null);
  };

  const confirmReactivate = (u: UserData) => {
    setReactivateUser(u);
  };

  const doReactivate = async () => {
    if (!reactivateUser) return;
    try {
      await fetch(`/api/admin/users/${reactivateUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: true }),
      });
      setFeedback(`Usuario ${reactivateUser.fullName} reactivado.`);
      fetchUsers();
    } catch {}
    setReactivateUser(null);
  };

  const openEdit = async (u: UserData) => {
    setEditUser(u);
    setEditCedula(u.cedula);
    setEditName(u.fullName);
    setEditEmail(u.email || "");
    setEditResetPin(false);
    setEditError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser || !editName || editCedula.length !== 10) return;
    setSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editName,
          cedula: editCedula,
          email: editEmail || null,
          resetPin: editResetPin,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setEditError(d.error); setSaving(false); return; }

      if (d.newPin) {
        setCreatedPin(d.newPin);
        setFeedback(`PIN de ${editName} restablecido.`);
      } else {
        setFeedback(`Usuario ${editName} actualizado.`);
      }
      setEditUser(null);
      fetchUsers();
    } catch { setEditError("Error de conexion"); }
    setSaving(false);
  };

  const resetForm = () => {
    setNewCedula("");
    setNewName("");
    setNewEmail("");
  };

  const copyCredentials = () => {
    if (createdPin) {
      navigator.clipboard.writeText(`Cedula: ${editCedula || newCedula}\nPIN: ${createdPin}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    setBulkResults(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      const parsed = lines.slice(0, 4).map(l => l.split(/[,;]/).map(c => c.trim().replace(/^"|"$/g, "")));
      setBulkPreview(parsed);
    };
    reader.readAsText(file, "UTF-8");
  };

  const doBulkImport = async () => {
    if (!bulkFile) return;
    setBulkImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      const res = await fetch("/api/admin/users/bulk", { method: "POST", body: formData });
      const d = await res.json();
      setBulkResults(d.resultados || []);
      if (res.ok) {
        fetchUsers();
        setBulkFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setBulkPreview([]);
      }
    } catch {}
    setBulkImporting(false);
  };

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.cedula.includes(search)
  );

  return (
    <div className="p-6 sm:p-8 w-full max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "student" ? "Estudiantes" : "Profesores"} registrados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowBulkImport(true)}>
            <Upload className="h-4 w-4" /> Importar CSV
          </Button>
          <Button onClick={() => { setShowCreate(true); setCreatedPin(null); setError(""); resetForm(); }} size="sm" className="gap-2">
            <UserPlus className="h-4 w-4" /> Nuevo {tab === "student" ? "estudiante" : "profesor"}
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 flex items-center justify-between">
          <span>{feedback}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setFeedback("")}><X className="h-3 w-3" /></Button>
        </div>
      )}

      {createdPin && (
        <Card className="shadow-lg border-emerald-300 bg-emerald-50/80 animate-scale-in">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 font-bold">
              <Check className="h-5 w-5" /> PIN generado exitosamente
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Cedula:</span> <strong>{editCedula || newCedula}</strong></div>
              <div><span className="text-muted-foreground">PIN:</span> <strong className="text-xl tracking-widest">{createdPin}</strong></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyCredentials}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado" : "Copiar credenciales"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setCreatedPin(null); setEditCedula(""); }}>Cerrar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk import panel */}
      {showBulkImport && (
        <Card className="shadow-sm animate-scale-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Importar estudiantes desde CSV</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => { setShowBulkImport(false); setBulkResults(null); setBulkFile(null); setBulkPreview([]); }}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
              <p className="font-semibold mb-1">Formato del archivo:</p>
              <p>El CSV debe tener las columnas: <strong>Cedula, Nombre Completo, Email</strong> (email es opcional).</p>
              <p className="mt-1">Ejemplo: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">1723456789;Juan Perez;juan@ejemplo.com</code></p>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleBulkFileChange}
                className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>

            {bulkPreview.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <p className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">Vista previa (primeras 3 filas + cabecera):</p>
                <div className="divide-y max-h-48 overflow-y-auto">
                  {bulkPreview.map((row, i) => (
                    <div key={i} className={`px-4 py-2 text-xs flex gap-4 ${i === 0 ? "font-semibold bg-muted/30" : ""}`}>
                      {row.map((cell, j) => (
                        <span key={j} className="truncate flex-1">{cell || "-"}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bulkResults && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-2xl font-bold text-emerald-700">{bulkResults.filter(r => r.status === "creado").length}</p>
                    <p className="text-xs text-emerald-600 font-medium">Creados</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-2xl font-bold text-blue-700">{bulkResults.filter(r => r.status === "reactivado").length}</p>
                    <p className="text-xs text-blue-600 font-medium">Reactivados</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-2xl font-bold text-amber-700">{bulkResults.filter(r => r.status === "omitido").length}</p>
                    <p className="text-xs text-amber-600 font-medium">Omitidos</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-2xl font-bold text-red-700">{bulkResults.filter(r => r.status === "error").length}</p>
                    <p className="text-xs text-red-600 font-medium">Errores</p>
                  </div>
                </div>
                {bulkResults.filter(r => r.status !== "creado").length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground font-medium py-1">Ver detalles</summary>
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {bulkResults.filter(r => r.status !== "creado").map((r, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/30">
                          <Badge variant={r.status === "error" ? "destructive" : r.status === "omitido" ? "secondary" : "default"} className="text-[10px]">
                            {r.status}
                          </Badge>
                          <span className="font-mono">{r.cedula}</span>
                          <span>{r.nombre}</span>
                          {r.razon && <span className="text-muted-foreground">- {r.razon}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={doBulkImport} disabled={!bulkFile || bulkImporting} className="gap-2">
                {bulkImporting && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar estudiantes
              </Button>
              <a
                href="data:text/csv;charset=utf-8,Cedula%3BNombre%20Completo%3BEmail%0A1723456789%3BJuan%20Perez%3Bjuan%40ejemplo.com%0A0987654321%3BMaria%20Gomez%3B"
                download="plantilla_alumnos.csv"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <Download className="h-4 w-4" /> Descargar plantilla
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showCreate && (
        <Card className="shadow-sm animate-scale-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Crear {tab === "student" ? "estudiante" : "profesor"}</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Cedula (10 digitos)</label>
                  <input
                    type="text" inputMode="numeric" maxLength={10} value={newCedula}
                    onChange={e => setNewCedula(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                    placeholder="1723456789"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Nombre completo</label>
                  <input
                    type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                    placeholder="Juan Perez"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Correo electronico (opcional)</label>
                <input
                  type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm"
                  placeholder="juan@ejemplo.com"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear usuario
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="max-w-md w-full mx-4 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Editar {editUser.role === "student" ? "estudiante" : "profesor"}</CardTitle>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditUser(null)}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Cedula</label>
                  <input
                    type="text" inputMode="numeric" maxLength={10} value={editCedula}
                    onChange={e => setEditCedula(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Nombre completo</label>
                  <input
                    type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Correo electronico</label>
                  <input
                    type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm"
                    placeholder="juan@ejemplo.com"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editResetPin} onChange={e => setEditResetPin(e.target.checked)} className="h-4 w-4 rounded border-input" />
                  <span className="text-sm">Generar nuevo PIN</span>
                </label>
                {editError && <p className="text-sm text-red-600">{editError}</p>}
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar cambios
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deactivate confirmation dialog */}
      <Dialog open={!!deactivateUser} onOpenChange={(open) => { if (!open) setDeactivateUser(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Desactivar usuario</DialogTitle>
            </div>
            <DialogDescription>
              {deactivateUser && (
                <>
                  ¿Estas seguro de desactivar a <strong>{deactivateUser.fullName}</strong>?
                  <br /><br />
                  El usuario <strong>no podra iniciar sesion</strong> en la plataforma, pero sus datos (calificaciones, progreso, tareas) se conservaran. Podras reactivarlo en cualquier momento.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={doDeactivate} className="gap-2">
              <Power className="h-4 w-4" /> Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate confirmation dialog */}
      <Dialog open={!!reactivateUser} onOpenChange={(open) => { if (!open) setReactivateUser(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
              <DialogTitle>Reactivar usuario</DialogTitle>
            </div>
            <DialogDescription>
              {reactivateUser && (
                <>
                  ¿Deseas reactivar a <strong>{reactivateUser.fullName}</strong>?
                  <br /><br />
                  Podra volver a iniciar sesion con sus credenciales anteriores.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateUser(null)}>Cancelar</Button>
            <Button onClick={doReactivate} className="gap-2">
              <PowerOff className="h-4 w-4" /> Reactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted/50 rounded-xl">
        <button
          onClick={() => setTab("student")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${tab === "student" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          Estudiantes
        </button>
        <button
          onClick={() => setTab("teacher")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${tab === "teacher" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
        >
          Profesores
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o cedula..."
            className="w-full h-10 pl-10 rounded-lg border border-input bg-card px-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground whitespace-nowrap">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Mostrar inactivos
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No hay {tab === "student" ? "estudiantes" : "profesores"} registrados</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map(u => (
                <div key={u.id} className={`flex items-center justify-between p-4 ${!u.activo ? "opacity-50 bg-muted/30" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
                      {u.fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.cedula}
                        {u.email && ` · ${u.email}`}
                      </p>
                      {u.role === "teacher" && u.subjects && u.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {u.subjects.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] py-0 gap-1">
                              <span>{s.subjectEmoji}</span> {s.subjectName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!u.activo && (
                      <Badge variant="destructive" className="text-[10px]">Inactivo</Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {u.role === "student" ? "Estudiante" : "Profesor"}
                    </Badge>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(u)} className="text-muted-foreground hover:text-primary" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.activo ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => confirmDeactivate(u)} className="text-muted-foreground hover:text-amber-600" title="Desactivar">
                        <Power className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" onClick={() => confirmReactivate(u)} className="text-muted-foreground hover:text-emerald-600" title="Reactivar">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
