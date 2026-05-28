"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Trash2, ArrowRight, Users as UsersIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CursoData {
  id: number;
  nombre: string;
  nivel: string;
  profesorId: number | null;
  profesorNombre: string | null;
  activo: boolean;
  studentCount: number;
  createdAt: string;
}

interface ProfesorOption {
  id: number;
  fullName: string;
}

export default function AdminCursosPage() {
  const router = useRouter();
  const [cursos, setCursos] = useState<CursoData[]>([]);
  const [profesores, setProfesores] = useState<ProfesorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [nombre, setNombre] = useState("");
  const [nivel, setNivel] = useState("");
  const [profesorId, setProfesorId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, pr] = await Promise.all([
        fetch("/api/admin/courses").then(r => r.json()),
        fetch("/api/admin/users?role=teacher").then(r => r.json()),
      ]);
      setCursos(cr.cursos || []);
      setProfesores(pr.users || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !nivel) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, nivel, profesorId }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNombre("");
        setNivel("");
        setProfesorId(null);
        fetchData();
      } else {
        const d = await res.json();
        setError(d.error);
      }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
      fetchData();
    } catch {}
  };

  return (
    <div className="p-6 sm:p-8 w-full max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cursos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona los cursos y asigna profesores</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setError(""); }} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo curso
        </Button>
      </div>

      {showCreate && (
        <Card className="shadow-sm animate-scale-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Crear curso</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Nombre del curso</label>
                  <input
                    type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                    placeholder="3ro Bachillerato A"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Nivel</label>
                  <input
                    type="text" value={nivel} onChange={e => setNivel(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                    placeholder="3ro Bachillerato"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">Profesor asignado</label>
                <select
                  value={profesorId || ""}
                  onChange={e => setProfesorId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {profesores.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear curso
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : cursos.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No hay cursos creados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {cursos.map(c => (
            <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer min-w-0" onClick={() => router.push(`/admin/cursos/${c.id}`)}>
                    <h3 className="font-bold text-foreground truncate">{c.nombre}</h3>
                    <p className="text-sm text-muted-foreground">{c.nivel}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.profesorNombre || "Sin profesor"}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                      <UsersIcon className="h-3 w-3" /> {c.studentCount}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/admin/cursos/${c.id}`)}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  Gestionar estudiantes <ArrowRight className="h-3 w-3" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
