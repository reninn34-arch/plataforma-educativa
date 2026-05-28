"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Trash2, ArrowRight, Users as UsersIcon, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TeacherSubjectRow {
  teacherId: number | null;
  subjectId: number | null;
}

interface CursoTeacherSubject {
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  subjectEmoji: string;
}

interface CursoData {
  id: number;
  nombre: string;
  nivel: string;
  profesorId: number | null;
  profesorNombre: string | null;
  activo: boolean;
  studentCount: number;
  createdAt: string;
  teacherSubjects: CursoTeacherSubject[];
}

interface ProfesorOption {
  id: number;
  fullName: string;
}

interface SubjectOption {
  id: number;
  name: string;
  emoji: string;
  slug: string;
}

export default function AdminCursosPage() {
  const router = useRouter();
  const [cursos, setCursos] = useState<CursoData[]>([]);
  const [profesores, setProfesores] = useState<ProfesorOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [nombre, setNombre] = useState("");
  const [nivel, setNivel] = useState("");
  const [profesorId, setProfesorId] = useState<number | null>(null);
  const [createRows, setCreateRows] = useState<TeacherSubjectRow[]>([
    { teacherId: null, subjectId: null },
  ]);

  // Edit state
  const [editingCurso, setEditingCurso] = useState<CursoData | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editNivel, setEditNivel] = useState("");
  const [editProfesorId, setEditProfesorId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<TeacherSubjectRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, pr, sr] = await Promise.all([
        fetch("/api/admin/courses").then(r => r.json()),
        fetch("/api/admin/users?role=teacher").then(r => r.json()),
        fetch("/api/subjects").then(r => r.json()),
      ]);
      setCursos(cr.cursos || []);
      setProfesores(pr.users || []);
      setSubjects(sr.subjects || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- CREATE ----
  const addCreateRow = () => {
    setCreateRows([...createRows, { teacherId: null, subjectId: null }]);
  };
  const removeCreateRow = (idx: number) => {
    if (createRows.length <= 1) return;
    setCreateRows(createRows.filter((_, i) => i !== idx));
  };
  const updateCreateRow = (idx: number, field: "teacherId" | "subjectId", value: number | null) => {
    const updated = [...createRows];
    updated[idx] = { ...updated[idx], [field]: value };
    setCreateRows(updated);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !nivel) return;
    setSaving(true);
    setError("");

    const validTeacherSubjects = createRows
      .filter(ts => ts.teacherId && ts.subjectId)
      .map(ts => ({ teacherId: ts.teacherId!, subjectId: ts.subjectId! }));

    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, nivel, profesorId, teacherSubjects: validTeacherSubjects }),
      });
      if (res.ok) {
        resetCreate();
        fetchData();
      } else {
        const d = await res.json();
        setError(d.error);
      }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  const resetCreate = () => {
    setShowCreate(false);
    setNombre("");
    setNivel("");
    setProfesorId(null);
    setCreateRows([{ teacherId: null, subjectId: null }]);
  };

  // ---- EDIT ----
  const openEdit = (c: CursoData) => {
    setEditingCurso(c);
    setEditNombre(c.nombre);
    setEditNivel(c.nivel);
    setEditProfesorId(c.profesorId);
    if (c.teacherSubjects.length > 0) {
      setEditRows(
        c.teacherSubjects.map(ts => ({ teacherId: ts.teacherId, subjectId: ts.subjectId }))
      );
    } else {
      setEditRows([{ teacherId: null, subjectId: null }]);
    }
    setError("");
  };

  const addEditRow = () => {
    setEditRows([...editRows, { teacherId: null, subjectId: null }]);
  };
  const removeEditRow = (idx: number) => {
    if (editRows.length <= 1) return;
    setEditRows(editRows.filter((_, i) => i !== idx));
  };
  const updateEditRow = (idx: number, field: "teacherId" | "subjectId", value: number | null) => {
    const updated = [...editRows];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditRows(updated);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurso || !editNombre || !editNivel) return;
    setSaving(true);
    setError("");

    const validTeacherSubjects = editRows
      .filter(ts => ts.teacherId && ts.subjectId)
      .map(ts => ({ teacherId: ts.teacherId!, subjectId: ts.subjectId! }));

    try {
      const res = await fetch(`/api/admin/courses/${editingCurso.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: editNombre,
          nivel: editNivel,
          profesorId: editProfesorId,
          teacherSubjects: validTeacherSubjects,
        }),
      });
      if (res.ok) {
        setFeedback(`Curso "${editNombre}" actualizado.`);
        setEditingCurso(null);
        fetchData();
      } else {
        const d = await res.json();
        setError(d.error);
      }
    } catch { setError("Error de conexion"); }
    setSaving(false);
  };

  // ---- DELETE ----
  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
      fetchData();
    } catch {}
  };

  // Helper: check if teacher+subject combo already exists in current rows
  const comboExists = (rows: TeacherSubjectRow[], idx: number): boolean => {
    const row = rows[idx];
    if (!row.teacherId || !row.subjectId) return false;
    return rows.some((r, i) => i !== idx && r.teacherId === row.teacherId && r.subjectId === row.subjectId);
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

      {feedback && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 flex items-center justify-between">
          <span>{feedback}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setFeedback("")}><X className="h-3 w-3" /></Button>
        </div>
      )}

      {/* ======= CREATE PANEL ======= */}
      {showCreate && (
        <Card className="shadow-sm animate-scale-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Crear curso</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={resetCreate}><X className="h-4 w-4" /></Button>
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
                <label className="text-sm font-semibold mb-1.5 block">Profesor tutor (coordinador de curso)</label>
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
              {renderTeacherSubjectSection(createRows, addCreateRow, removeCreateRow, updateCreateRow, profesores, subjects, comboExists)}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear curso
                </Button>
                <Button type="button" variant="outline" onClick={resetCreate}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ======= EDIT MODAL ======= */}
      {editingCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="max-w-lg w-full mx-4 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Editar: {editingCurso.nombre}</CardTitle>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditingCurso(null)}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">Nombre del curso</label>
                    <input
                      type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                      className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">Nivel</label>
                    <input
                      type="text" value={editNivel} onChange={e => setEditNivel(e.target.value)}
                      className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm" required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Profesor tutor (coordinador de curso)</label>
                  <select
                    value={editProfesorId || ""}
                    onChange={e => setEditProfesorId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm"
                  >
                    <option value="">Sin asignar</option>
                    {profesores.map(p => (
                      <option key={p.id} value={p.id}>{p.fullName}</option>
                    ))}
                  </select>
                </div>
                {renderTeacherSubjectSection(editRows, addEditRow, removeEditRow, updateEditRow, profesores, subjects, comboExists)}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar cambios
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingCurso(null)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======= COURSE LIST ======= */}
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)} className="text-muted-foreground hover:text-primary" title="Editar curso">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive" title="Eliminar curso">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {c.teacherSubjects.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.teacherSubjects.map((ts, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] py-0.5 gap-1">
                        <span>{ts.subjectEmoji}</span>
                        <span className="max-w-[80px] truncate">{ts.teacherName}</span>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.profesorNombre ? `Tutor: ${c.profesorNombre}` : "Sin tutor"}</span>
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
                {c.studentCount > 0 && (
                  <button
                    onClick={() => router.push(`/admin/boletin/${c.id}`)}
                    className="flex items-center gap-1 text-xs text-emerald-600 font-medium hover:underline"
                  >
                    Ver boletin <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Shared teacher-subject rows UI
function renderTeacherSubjectSection(
  rows: TeacherSubjectRow[],
  onAdd: () => void,
  onRemove: (idx: number) => void,
  onUpdate: (idx: number, field: "teacherId" | "subjectId", value: number | null) => void,
  profesores: ProfesorOption[],
  subjects: SubjectOption[],
  comboExists: (rows: TeacherSubjectRow[], idx: number) => boolean,
) {
  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold">Profesores por materia</label>
        <Button type="button" variant="outline" size="sm" onClick={onAdd} className="gap-1 text-xs h-7">
          <Plus className="h-3 w-3" /> Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((row, idx) => {
          const isDuplicateCombo = comboExists(rows, idx);
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-2">
                <select
                  value={row.subjectId || ""}
                  onChange={e => onUpdate(idx, "subjectId", e.target.value ? Number(e.target.value) : null)}
                  className="flex-1 h-10 rounded-lg border border-input bg-card px-3 text-sm"
                >
                  <option value="">Materia...</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={row.teacherId || ""}
                  onChange={e => onUpdate(idx, "teacherId", e.target.value ? Number(e.target.value) : null)}
                  className="flex-1 h-10 rounded-lg border border-input bg-card px-3 text-sm"
                >
                  <option value="">Profesor...</option>
                  {profesores.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName}</option>
                  ))}
                </select>
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(idx)} className="shrink-0 text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {isDuplicateCombo && (
                <p className="text-xs text-amber-600 ml-1">
                  Ese profesor ya tiene esa materia asignada en este curso.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
