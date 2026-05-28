"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X, Pencil, Trash2, Calendar, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Periodo {
  id: number;
  nombre: string;
  activo: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  createdAt: string;
}

export default function AdminPeriodosPage() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editFechaI, setEditFechaI] = useState("");
  const [editFechaF, setEditFechaF] = useState("");

  const fetchPeriodos = () => {
    setLoading(true);
    fetch("/api/admin/periodos")
      .then(r => r.json())
      .then(d => { setPeriodos(d.periodos || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchPeriodos(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/periodos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, fechaInicio: fechaInicio || null, fechaFin: fechaFin || null }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNombre("");
        setFechaInicio("");
        setFechaFin("");
        setFeedback(`Período "${nombre}" creado y activado.`);
        fetchPeriodos();
      } else {
        const d = await res.json();
        setError(d.error);
      }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const toggleActivo = async (p: Periodo) => {
    try {
      await fetch(`/api/admin/periodos/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !p.activo }),
      });
      fetchPeriodos();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/admin/periodos/${id}`, { method: "DELETE" });
      fetchPeriodos();
    } catch {}
  };

  const openEdit = (p: Periodo) => {
    setEditId(p.id);
    setEditNombre(p.nombre);
    setEditFechaI(p.fechaInicio ? p.fechaInicio.slice(0, 10) : "");
    setEditFechaF(p.fechaFin ? p.fechaFin.slice(0, 10) : "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNombre || !editId) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/periodos/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: editNombre,
          fechaInicio: editFechaI || null,
          fechaFin: editFechaF || null,
        }),
      });
      setEditId(null);
      fetchPeriodos();
    } catch { setError("Error al guardar"); }
    setSaving(false);
  };

  return (
    <div className="p-6 sm:p-8 w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Periodos Lectivos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona los parciales y anos lectivos</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setError(""); }} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo periodo
        </Button>
      </div>

      {feedback && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 flex items-center justify-between">
          <span>{feedback}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setFeedback("")}><X className="h-3 w-3" /></Button>
        </div>
      )}

      {showCreate && (
        <Card className="shadow-sm animate-scale-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Nuevo periodo lectivo</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Nombre</label>
                <input
                  type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                  placeholder="2025-2026"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Fecha inicio</label>
                  <input
                    type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Fecha fin</label>
                  <input
                    type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Al crear un nuevo periodo, se activara automaticamente. Solo un periodo puede estar activo.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear periodo
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="max-w-sm w-full mx-4 shadow-xl animate-scale-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Editar periodo</CardTitle>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Nombre</label>
                  <input
                    type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Inicio</label>
                    <input
                      type="date" value={editFechaI} onChange={e => setEditFechaI(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">Fin</label>
                    <input
                      type="date" value={editFechaF} onChange={e => setEditFechaF(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-card px-3 text-xs"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditId(null)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : periodos.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 font-medium text-muted-foreground">No hay periodos lectivos</p>
            <p className="text-sm text-muted-foreground mt-1">Crea el primer periodo para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y">
              {periodos.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-4 ${p.activo ? "bg-emerald-50/30" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${p.activo ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.fechaInicio ? new Date(p.fechaInicio).toLocaleDateString("es-EC") : "Sin inicio"}
                        {" → "}
                        {p.fechaFin ? new Date(p.fechaFin).toLocaleDateString("es-EC") : "Sin fin"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.activo ? "default" : "secondary"} className="text-[10px] gap-1">
                      {p.activo ? <><CheckCircle2 className="h-3 w-3" /> Activo</> : <><Clock className="h-3 w-3" /> Inactivo</>}
                    </Badge>
                    <Button variant="ghost" size="icon-sm" onClick={() => toggleActivo(p)} title={p.activo ? "Desactivar" : "Activar"} className="text-muted-foreground hover:text-primary">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} className="text-muted-foreground hover:text-blue-600" title="Editar">
                      <Calendar className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive" title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
