"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, X, Trash2, Pencil, AlertTriangle, CheckCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface SubjectData {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  color: string;
}

interface SubjectsData {
  subjects: SubjectData[];
}

const PREDEFINED_COLORS = [
  { label: "Indigo", hex: "#6366F1" },
  { label: "Azul", hex: "#3B82F6" },
  { label: "Celeste", hex: "#06B6D4" },
  { label: "Esmeralda", hex: "#10B981" },
  { label: "Verde", hex: "#22C55E" },
  { label: "Ámbar", hex: "#F59E0B" },
  { label: "Naranja", hex: "#F97316" },
  { label: "Rojo", hex: "#EF4444" },
  { label: "Rosa", hex: "#EC4899" },
  { label: "Violeta", hex: "#8B5CF6" },
  { label: "Púrpura", hex: "#A855F7" },
  { label: "Gris", hex: "#6B7280" },
];

const COMMON_EMOJIS = ["🔢", "⚡", "🧪", "🗣", "📚", "🎨", "🌍", "🎵", "💻", "🔬", "📐", "🌿", "🏛", "🧮", "🎭", "🧬", "⚽", "🏗", "🍃", "🖋"];

export default function AdminSubjectsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SubjectsData, Error>({
    queryKey: ["admin-subjects"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/subjects");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const subjects = data?.subjects || [];

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmoji, setCreateEmoji] = useState("");
  const [createColor, setCreateColor] = useState(PREDEFINED_COLORS[0].hex);

  const [editSubject, setEditSubject] = useState<SubjectData | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSlug, setEditSlug] = useState("");

  const [deleteSubject, setDeleteSubject] = useState<SubjectData | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-subjects"] });
    queryClient.invalidateQueries({ queryKey: ["subjects"] });
  }, [queryClient]);

  const handleCreate = async () => {
    if (!createName.trim() || !createEmoji.trim()) {
      setError("Nombre y emoji son requeridos");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), emoji: createEmoji.trim(), color: createColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear materia");
      } else {
        setShowCreate(false);
        setCreateName("");
        setCreateEmoji("");
        setCreateColor(PREDEFINED_COLORS[0].hex);
        invalidate();
        setFeedback("Materia creada exitosamente");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch {
      setError("Error de conexión");
    }
    setSaving(false);
  };

  const startEdit = (subject: SubjectData) => {
    setEditSubject(subject);
    setEditName(subject.name);
    setEditEmoji(subject.emoji);
    setEditColor(subject.color);
    setEditSlug(subject.slug);
  };

  const handleEdit = async () => {
    if (!editSubject || !editName.trim() || !editEmoji.trim()) {
      setError("Nombre y emoji son requeridos");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/subjects/${editSubject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), emoji: editEmoji.trim(), color: editColor, slug: editSlug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al actualizar");
      } else {
        setEditSubject(null);
        invalidate();
        setFeedback("Materia actualizada");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch {
      setError("Error de conexión");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteSubject) return;
    setSaving(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`/api/admin/subjects/${deleteSubject.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || "Error al eliminar");
      } else {
        setDeleteSubject(null);
        invalidate();
        setFeedback("Materia eliminada");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch {
      setDeleteError("Error de conexión");
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestionar Materias</h1>
          <p className="text-sm text-muted-foreground mt-1">{subjects.length} materias registradas</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200">
          <Plus className="h-4 w-4" /> Nueva Materia
        </Button>
      </div>

      {feedback && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />{feedback}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border py-16 text-center shadow-sm">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 font-medium text-muted-foreground">No hay materias registradas</p>
          <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200">
            <Plus className="h-4 w-4" /> Crear primera materia
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-3xl shrink-0">{subject.emoji}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground truncate">{subject.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{subject.slug}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => startEdit(subject)} className="text-slate-400 hover:text-indigo-600">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-red-400 hover:text-red-600" onClick={() => { setDeleteSubject(subject); setDeleteError(""); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className="w-5 h-5 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: subject.color }}
                />
                <Badge variant="outline" className="text-[10px] rounded-lg border-border font-mono">
                  {subject.color}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-foreground">Nueva Materia</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setShowCreate(false); setError(""); }} className="text-slate-400 hover:text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nombre</label>
                <input
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                  placeholder="Ej: Historia del Ecuador"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Emoji</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={createEmoji}
                    onChange={e => setCreateEmoji(e.target.value)}
                    className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                    placeholder="🔢"
                  />
                  <span className="text-2xl self-center min-w-[2rem] text-center">{createEmoji || "?"}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {COMMON_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCreateEmoji(emoji)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm border transition-all cursor-pointer ${createEmoji === emoji ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200" : "border-border hover:border-indigo-200 hover:bg-indigo-50/50"}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setCreateColor(c.hex)}
                      className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${createColor === c.hex ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-110"}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">O personalizado:</span>
                  <input
                    type="color"
                    value={createColor}
                    onChange={e => setCreateColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{createColor}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setShowCreate(false); setError(""); }} className="rounded-xl border-border">
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Crear Materia
              </Button>
            </div>
          </div>
        </div>
      )}

      {editSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-foreground">Editar Materia</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditSubject(null); setError(""); }} className="text-slate-400 hover:text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nombre</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Slug (identificador único)</label>
                <input
                  value={editSlug}
                  onChange={e => setEditSlug(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-mono focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Emoji</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={editEmoji}
                    onChange={e => setEditEmoji(e.target.value)}
                    className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all"
                  />
                  <span className="text-2xl self-center min-w-[2rem] text-center">{editEmoji || "?"}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {COMMON_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditEmoji(emoji)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm border transition-all cursor-pointer ${editEmoji === emoji ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200" : "border-border hover:border-indigo-200 hover:bg-indigo-50/50"}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setEditColor(c.hex)}
                      className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${editColor === c.hex ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-110"}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">O personalizado:</span>
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{editColor}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setEditSubject(null); setError(""); }} className="rounded-xl border-border">
                Cancelar
              </Button>
              <Button onClick={handleEdit} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}Guardar Cambios
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-xl shadow-slate-200/50 w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="font-bold text-foreground">Eliminar Materia</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              ¿Estás seguro de eliminar <strong className="text-foreground">{deleteSubject.emoji} {deleteSubject.name}</strong>?
            </p>
            {deleteSubject && (
              <p className="text-xs text-muted-foreground mb-4">
                Slug: <code className="text-foreground font-mono">{deleteSubject.slug}</code>
              </p>
            )}
            {deleteError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />{deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleteSubject(null); setDeleteError(""); }} className="rounded-xl border-border">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={saving} className="rounded-xl gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
