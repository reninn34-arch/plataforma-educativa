"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Pencil, Trash2, Search, Loader2, X, Copy, Check, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserData {
  id: number;
  cedula: string;
  fullName: string;
  role: string;
  email: string | null;
  activo: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<"student" | "teacher">("student");
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newCedula, setNewCedula] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit state
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editCedula, setEditCedula] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editResetPin, setEditResetPin] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?role=${tab}`);
      const d = await res.json();
      setUsers(d.users || []);
    } catch {}
    setLoading(false);
  }, [tab]);

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

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) fetchUsers();
    } catch {}
  };

  const handleReactivate = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: true }) });
      if (res.ok) fetchUsers();
    } catch {}
  };

  const openEdit = (u: UserData) => {
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
        <Button onClick={() => { setShowCreate(true); setCreatedPin(null); setError(""); resetForm(); }} size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" /> Nuevo {tab === "student" ? "estudiante" : "profesor"}
        </Button>
      </div>

      {feedback && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">
          {feedback}
        </div>
      )}

      {/* New PIN shown after reset */}
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
          <Card className="max-w-md w-full mx-4 shadow-xl animate-scale-in">
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o cedula..."
          className="w-full h-10 pl-10 rounded-lg border border-input bg-card px-3 text-sm"
        />
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
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(u.id)} className="text-muted-foreground hover:text-destructive" title="Desactivar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" onClick={() => handleReactivate(u.id)} className="text-muted-foreground hover:text-emerald-600" title="Reactivar">
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
