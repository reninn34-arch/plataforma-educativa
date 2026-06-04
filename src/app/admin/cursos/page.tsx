"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Trash2, ArrowRight, Users as UsersIcon, Pencil, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface TeacherSubjectRow { teacherId: number | null; subjectId: number | null; }
interface CursoTeacherSubject { teacherId: number; teacherName: string; subjectId: number; subjectName: string; subjectEmoji: string; }
interface CursoData { id: number; nombre: string; nivel: string; profesorId: number | null; profesorNombre: string | null; activo: boolean; studentCount: number; createdAt: string; teacherSubjects: CursoTeacherSubject[]; }
interface CursoDeleteData { id: number; nombre: string; }
interface ProfesorOption { id: number; fullName: string; }
interface SubjectOption { id: number; name: string; emoji: string; slug: string; }
interface CoursesData { cursos: CursoData[]; }
interface TeachersData { users: ProfesorOption[]; }
interface SubjectsData { subjects: SubjectOption[]; }

export default function AdminCursosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: coursesData, isLoading: coursesLoading } = useQuery<CoursesData, Error>({
    queryKey: ["admin-courses"],
    queryFn: async () => { const res = await apiFetch("/api/admin/courses"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: teachersData, isLoading: teachersLoading } = useQuery<TeachersData, Error>({
    queryKey: ["admin-teachers"],
    queryFn: async () => { const res = await apiFetch("/api/admin/users?role=teacher"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery<SubjectsData, Error>({
    queryKey: ["subjects"],
    queryFn: async () => { const res = await apiFetch("/api/subjects"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = coursesLoading || teachersLoading || subjectsLoading;
  const cursos = coursesData?.cursos || [];
  const profesores = teachersData?.users || [];
  const subjects = subjectsData?.subjects || [];

  const [showCreate, setShowCreate] = useState(false);
  const [nombre, setNombre] = useState("");
  const [nivel, setNivel] = useState("");
  const [profesorId, setProfesorId] = useState<number | null>(null);
  const [createRows, setCreateRows] = useState<TeacherSubjectRow[]>([{ teacherId: null, subjectId: null }]);

  const [editingCurso, setEditingCurso] = useState<CursoData | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editNivel, setEditNivel] = useState("");
  const [editProfesorId, setEditProfesorId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<TeacherSubjectRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deleteCurso, setDeleteCurso] = useState<CursoDeleteData | null>(null);

  const invalidateCourses = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
  }, [queryClient]);

  const addCreateRow = () => { setCreateRows([...createRows, { teacherId: null, subjectId: null }]); };
  const removeCreateRow = (idx: number) => { if (createRows.length <= 1) return; setCreateRows(createRows.filter((_, i) => i !== idx)); };
  const updateCreateRow = (idx: number, field: "teacherId" | "subjectId", value: number | null) => {
    const updated = [...createRows]; updated[idx] = { ...updated[idx], [field]: value }; setCreateRows(updated);
  };

  const handleCreate = async () => {
    if (!nombre.trim() || !nivel.trim()) { setError("Todos los campos son requeridos"); return; }
    setSaving(true); setError("");
    try {
      const teacherSubjects = createRows.filter(r => r.teacherId && r.subjectId).map(r => ({ teacherId: r.teacherId!, subjectId: r.subjectId! }));
      const res = await apiFetch("/api/admin/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim(), nivel: nivel.trim(), profesorId, teacherSubjects }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al crear curso"); }
      else { setShowCreate(false); setNombre(""); setNivel(""); setProfesorId(null); setCreateRows([{ teacherId: null, subjectId: null }]); invalidateCourses(); setFeedback("Curso creado exitosamente"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  const startEdit = (curso: CursoData) => {
    setEditingCurso(curso); setEditNombre(curso.nombre); setEditNivel(curso.nivel); setEditProfesorId(curso.profesorId);
    setEditRows(curso.teacherSubjects.map(ts => ({ teacherId: ts.teacherId, subjectId: ts.subjectId })));
  };

  const addEditRow = () => { setEditRows([...editRows, { teacherId: null, subjectId: null }]); };
  const removeEditRow = (idx: number) => { if (editRows.length <= 1) return; setEditRows(editRows.filter((_, i) => i !== idx)); };
  const updateEditRow = (idx: number, field: "teacherId" | "subjectId", value: number | null) => {
    const updated = [...editRows]; updated[idx] = { ...updated[idx], [field]: value }; setEditRows(updated);
  };

  const handleEdit = async () => {
    if (!editingCurso || !editNombre.trim() || !editNivel.trim()) { setError("Todos los campos son requeridos"); return; }
    setSaving(true); setError("");
    try {
      const teacherSubjects = editRows.filter(r => r.teacherId && r.subjectId).map(r => ({ teacherId: r.teacherId!, subjectId: r.subjectId! }));
      const res = await apiFetch(`/api/admin/courses/${editingCurso.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: editNombre.trim(), nivel: editNivel.trim(), profesorId: editProfesorId, teacherSubjects }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al actualizar"); }
      else { setEditingCurso(null); invalidateCourses(); setFeedback("Curso actualizado"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteCurso) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/courses/${deleteCurso.id}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); setError(data.error || "Error al eliminar"); }
      else { setDeleteCurso(null); invalidateCourses(); setFeedback("Curso eliminado"); setTimeout(() => setFeedback(""), 3000); }
    } catch { setError("Error de conexión"); }
    setSaving(false);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="p-6 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestionar Cursos</h1>
          <p className="text-sm text-slate-500 mt-1">{cursos.length} cursos creados</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"><Plus className="h-4 w-4" /> Nuevo Curso</Button>
      </div>

      {feedback && (<div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">{feedback}</div>)}
      {error && (<div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>)}

      {cursos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center shadow-sm">
          <UsersIcon className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 font-medium text-slate-500">No hay cursos creados</p>
          <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"><Plus className="h-4 w-4" /> Crear primer curso</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {cursos.map(curso => (
            <div key={curso.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 truncate">{curso.nombre}</h3>
                      <Badge variant={curso.activo ? "default" : "secondary"} className="text-[10px] rounded-lg">{curso.activo ? "Activo" : "Inactivo"}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{curso.nivel} — {curso.profesorNombre || "Sin tutor"}</p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><UsersIcon className="h-3 w-3" />{curso.studentCount} estudiantes</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1 rounded-xl border-slate-200" onClick={() => router.push(`/admin/cursos/${curso.id}`)}><ArrowRight className="h-3 w-3" />Gestionar</Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(curso)} className="text-slate-400 hover:text-indigo-600"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon-sm" className="text-red-400 hover:text-red-600" onClick={() => setDeleteCurso({ id: curso.id, nombre: curso.nombre })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {curso.teacherSubjects.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {curso.teacherSubjects.map((ts, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] gap-1 rounded-lg border-slate-200">{ts.subjectEmoji} {ts.subjectName}<span className="text-slate-400 ml-1">— {ts.teacherName}</span></Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Nuevo Curso</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setShowCreate(false); setError(""); }} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Nombre del curso</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="Ej: Matemáticas 3 BGU" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Nivel / Paralelo</label>
                <input value={nivel} onChange={e => setNivel(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" placeholder="Ej: 3 BGU" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Tutor (opcional)</label>
                <select value={profesorId || ""} onChange={e => setProfesorId(e.target.value ? parseInt(e.target.value) : null)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
                  <option value="">Sin tutor asignado</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">Profesores y materias</label>
                  <Button variant="ghost" size="sm" onClick={addCreateRow} className="gap-1 text-indigo-600"><Plus className="h-3 w-3" />Agregar</Button>
                </div>
                <div className="space-y-2">
                  {createRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select value={row.teacherId || ""} onChange={e => updateCreateRow(idx, "teacherId", e.target.value ? parseInt(e.target.value) : null)} className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
                        <option value="">Profesor</option>
                        {profesores.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                      </select>
                      <select value={row.subjectId || ""} onChange={e => updateCreateRow(idx, "subjectId", e.target.value ? parseInt(e.target.value) : null)} className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
                        <option value="">Materia</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                      </select>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeCreateRow(idx)} className="shrink-0 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setShowCreate(false); setError(""); }} className="rounded-xl border-slate-200">Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Crear Curso</Button>
            </div>
          </div>
        </div>
      )}

      {editingCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Editar Curso</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditingCurso(null); setError(""); }} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Nombre del curso</label>
                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Nivel / Paralelo</label>
                <input value={editNivel} onChange={e => setEditNivel(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Tutor (opcional)</label>
                <select value={editProfesorId || ""} onChange={e => setEditProfesorId(e.target.value ? parseInt(e.target.value) : null)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
                  <option value="">Sin tutor</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">Profesores y materias</label>
                  <Button variant="ghost" size="sm" onClick={addEditRow} className="gap-1 text-indigo-600"><Plus className="h-3 w-3" />Agregar</Button>
                </div>
                <div className="space-y-2">
                  {editRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2">
                      <select value={row.teacherId || ""} onChange={e => updateEditRow(idx, "teacherId", e.target.value ? parseInt(e.target.value) : null)} className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
                        <option value="">Profesor</option>
                        {profesores.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                      </select>
                      <select value={row.subjectId || ""} onChange={e => updateEditRow(idx, "subjectId", e.target.value ? parseInt(e.target.value) : null)} className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
                        <option value="">Materia</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                      </select>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeEditRow(idx)} className="shrink-0 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setEditingCurso(null); setError(""); }} className="rounded-xl border-slate-200">Cancelar</Button>
              <Button onClick={handleEdit} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}Guardar Cambios</Button>
            </div>
          </div>
        </div>
      )}

      {deleteCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="font-bold text-slate-800">Eliminar Curso</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">¿Estás seguro de eliminar <strong className="text-slate-700">{deleteCurso.nombre}</strong>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteCurso(null)} className="rounded-xl border-slate-200">Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={saving} className="rounded-xl gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
