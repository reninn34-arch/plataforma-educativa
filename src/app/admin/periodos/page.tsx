"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X, Pencil, Trash2, Calendar, CheckCircle2, Clock, AlertTriangle, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface Periodo { id: number; nombre: string; activo: boolean; fechaInicio: string | null; fechaFin: string | null; createdAt: string; }
interface PeriodosData { periodos: Periodo[]; }

export default function AdminPeriodosPage() {
  const [feedback, setFeedback] = useState("");
  const [deletePeriodo, setDeletePeriodo] = useState<Periodo | null>(null);
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

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<PeriodosData, Error>({
    queryKey: ["admin-periodos"],
    queryFn: async () => { const res = await apiFetch("/api/admin/periodos"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const periodos = data?.periodos || [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-periodos"] });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return;
    setSaving(true); setError("");
    try {
      const res = await apiFetch("/api/admin/periodos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, fechaInicio: fechaInicio || null, fechaFin: fechaFin || null }) });
      if (res.ok) { setShowCreate(false); setNombre(""); setFechaInicio(""); setFechaFin(""); invalidate(); setFeedback("Periodo creado"); setTimeout(() => setFeedback(""), 3000); }
      else { const d = await res.json(); setError(d.error || "Error"); }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const startEdit = (p: Periodo) => { setEditId(p.id); setEditNombre(p.nombre); setEditFechaI(p.fechaInicio || ""); setEditFechaF(p.fechaFin || ""); setError(""); };
  const handleEdit = async () => {
    if (!editId) return;
    setSaving(true); setError("");
    try {
      const res = await apiFetch(`/api/admin/periodos/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: editNombre, fechaInicio: editFechaI || null, fechaFin: editFechaF || null }) });
      if (res.ok) { setEditId(null); invalidate(); setFeedback("Periodo actualizado"); setTimeout(() => setFeedback(""), 3000); }
      else { const d = await res.json(); setError(d.error || "Error"); }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletePeriodo) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/periodos/${deletePeriodo.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); }
      else { setDeletePeriodo(null); invalidate(); setFeedback("Periodo eliminado"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const handleToggle = async (p: Periodo) => {
    try {
      const res = await apiFetch(`/api/admin/periodos/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !p.activo }) });
      if (res.ok) invalidate();
    } catch {}
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="p-6 sm:p-8 w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Periodos Lectivos</h1>
          <p className="text-sm text-muted-foreground mt-1">{periodos.length} periodos registrados</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Nuevo Periodo</Button>
      </div>

      {feedback && <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">{feedback}</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>}

      {periodos.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-16 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 font-medium text-muted-foreground">No hay periodos creados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {periodos.map(p => (
            <Card key={p.id} className="shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${p.activo ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    {p.activo ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.fechaInicio && p.fechaFin ? `${new Date(p.fechaInicio).toLocaleDateString("es-EC")} — ${new Date(p.fechaFin).toLocaleDateString("es-EC")}` : "Sin fechas definidas"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.activo ? "default" : "secondary"} className="text-[10px]">{p.activo ? "Activo" : "Inactivo"}</Badge>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleToggle(p)} title={p.activo ? "Desactivar" : "Activar"}><Power className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon-sm" className="text-red-500" onClick={() => setDeletePeriodo(p)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-foreground">Nuevo Periodo</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setShowCreate(false); setError(""); }}><X className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" placeholder="Quimestre 1 - 2024-2025" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fecha inicio</label>
                  <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fecha fin</label>
                  <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button type="submit" disabled={saving || !nombre} className="w-full gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Crear Periodo</Button>
            </form>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-foreground">Editar Periodo</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditId(null); setError(""); }}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fecha inicio</label>
                  <input type="date" value={editFechaI} onChange={e => setEditFechaI(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fecha fin</label>
                  <input type="date" value={editFechaF} onChange={e => setEditFechaF(e.target.value)} className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => { setEditId(null); setError(""); }}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {deletePeriodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <h2 className="font-bold text-foreground mb-2">Eliminar Periodo</h2>
            <p className="text-sm text-muted-foreground mb-6">Seguro que deseas eliminar <strong>{deletePeriodo.nombre}</strong>?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletePeriodo(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}