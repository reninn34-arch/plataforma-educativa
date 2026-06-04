"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, X, Clock, FileText, Save, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface AsistenciaRow { studentId: number; studentName: string; cedula: string; estado: string; }
interface CursoOption { id: number; nombre: string; nivel: string; }
interface CoursesData { cursos: CursoOption[]; }
interface AsistenciaData { asistencia: AsistenciaRow[]; }

const ESTADOS = [
  { value: "presente", label: "Presente", icon: Check, color: "bg-emerald-500 hover:bg-emerald-600", textColor: "text-emerald-700" },
  { value: "ausente", label: "Ausente", icon: X, color: "bg-red-500 hover:bg-red-600", textColor: "text-red-700" },
  { value: "tardanza", label: "Tardanza", icon: Clock, color: "bg-amber-500 hover:bg-amber-600", textColor: "text-amber-700" },
  { value: "justificado", label: "Justificado", icon: FileText, color: "bg-blue-500 hover:bg-blue-600", textColor: "text-blue-700" },
];

function formatFecha(fecha: Date): string { return fecha.toISOString().slice(0, 10); }
function fechaLegible(fecha: string): string { const [y, m, d] = fecha.split("-"); return `${d}/${m}/${y}`; }

export default function TeacherAsistenciaPage() {
  const [cursoId, setCursoId] = useState<number | null>(null);
  const [fecha, setFecha] = useState(formatFecha(new Date()));
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const { data: coursesData, isLoading: coursesLoading } = useQuery<CoursesData, Error>({
    queryKey: ["teacher-courses"],
    queryFn: async () => {
      const res = await apiFetch("/api/teacher/courses");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: asistenciaData, isLoading: asistenciaLoading } = useQuery<AsistenciaData, Error>({
    queryKey: ["teacher-asistencia", cursoId, fecha],
    queryFn: async () => {
      if (!cursoId) return { asistencia: [] };
      const res = await apiFetch(`/api/teacher/asistencia/${cursoId}?fecha=${fecha}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 0,
    enabled: !!cursoId,
  });

  const cursos = coursesData?.cursos || [];
  const baseAsistencia = asistenciaData?.asistencia || [];
  const loading = coursesLoading || asistenciaLoading;

  const asistencia = baseAsistencia.length > 0
    ? baseAsistencia.map(a => ({ ...a, estado: a.studentId in draft ? draft[a.studentId] : a.estado }))
    : [];

  const cambiarFecha = (dias: number) => {
    const f = new Date(fecha);
    f.setDate(f.getDate() + dias);
    setFecha(formatFecha(f));
    setDraft({});
  };

  const toggleEstado = (studentId: number, targetEstado: string) => {
    const actual = draft[studentId];
    if (actual === targetEstado) {
      setDraft(prev => ({ ...prev, [studentId]: "pendiente" }));
    } else {
      setDraft(prev => ({ ...prev, [studentId]: targetEstado }));
    }
  };

  const guardarAsistencia = async () => {
    if (!cursoId) return;
    const entries = Object.entries(draft) as [string, string][];
    if (entries.length === 0) {
      setFeedback("No hay cambios para guardar.");
      setTimeout(() => setFeedback(""), 3000);
      return;
    }
    setSaving(true);
    try {
      const registros = entries.map(([studentId, estado]) => ({ studentId: Number(studentId), estado }));
      const res = await apiFetch("/api/teacher/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cursoId, fecha, registros }),
      });
      if (res.ok) {
        setDraft({});
        setFeedback("Asistencia guardada correctamente.");
        setTimeout(() => setFeedback(""), 3000);
      } else {
        const d = await res.json();
        setFeedback(d.error || "Error al guardar");
      }
    } catch {
      setFeedback("Error de conexión");
    }
    setSaving(false);
  };

  const marcarTodosPresente = () => {
    const allPresente: Record<number, string> = {};
    for (const a of baseAsistencia) allPresente[a.studentId] = "presente";
    setDraft(allPresente);
  };

  const conteo = {
    presente: asistencia.filter(a => a.estado === "presente").length,
    ausente: asistencia.filter(a => a.estado === "ausente").length,
    tardanza: asistencia.filter(a => a.estado === "tardanza").length,
    justificado: asistencia.filter(a => a.estado === "justificado").length,
    pendiente: asistencia.filter(a => a.estado === "pendiente").length,
    total: asistencia.length,
  };

  const cursoSeleccionado = cursos.find(c => c.id === cursoId);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Cargando...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full animate-fade-in-up">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md">
              <ClipboardList size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Control de Asistencia</h1>
              <p className="text-sm text-slate-400">Registra la asistencia diaria de tus estudiantes</p>
            </div>
          </div>
        </div>

        {feedback && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between ${
            feedback.startsWith("Error") || feedback.includes("error")
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-emerald-50 border border-emerald-200 text-emerald-700"
          }`}>
            <span>{feedback}</span>
            <button onClick={() => setFeedback("")} className="text-slate-400 hover:text-slate-600">&times;</button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Curso</label>
              <select
                value={cursoId || ""}
                onChange={e => { setCursoId(e.target.value ? Number(e.target.value) : null); setDraft({}); }}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none min-w-[200px]"
              >
                <option value="">Seleccionar curso</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.nivel})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Fecha</label>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" onClick={() => cambiarFecha(-1)} className="rounded-lg border-slate-200"><ChevronLeft className="h-4 w-4" /></Button>
                <input type="date" value={fecha} onChange={e => { setFecha(e.target.value); setDraft({}); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none" />
                <Button variant="outline" size="icon-sm" onClick={() => cambiarFecha(1)} className="rounded-lg border-slate-200"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={marcarTodosPresente} className="h-10 gap-1 rounded-xl border-slate-200"><Check className="h-4 w-4" />Todos presentes</Button>
              <Button size="sm" onClick={guardarAsistencia} disabled={saving || Object.keys(draft).length === 0} className="h-10 gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
          {conteo.total > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
              <Badge className="text-xs gap-1 bg-emerald-100 text-emerald-700 border-emerald-200"><Check className="h-3 w-3" /> {conteo.presente} presentes</Badge>
              <Badge className="text-xs gap-1 bg-red-100 text-red-700 border-red-200"><X className="h-3 w-3" /> {conteo.ausente} ausentes</Badge>
              <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200"><Clock className="h-3 w-3" /> {conteo.tardanza} tardanzas</Badge>
              <Badge variant="outline" className="text-xs gap-1 border-blue-200 text-blue-700 bg-blue-50">{conteo.justificado} justificados</Badge>
              {conteo.pendiente > 0 && <Badge variant="outline" className="text-xs text-slate-400">{conteo.pendiente} sin marcar</Badge>}
            </div>
          )}
        </div>

        {cursoSeleccionado ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50">
              <h3 className="font-bold text-slate-800 text-sm">{cursoSeleccionado.nombre} · {fechaLegible(fecha)}</h3>
            </div>
            {asistencia.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-slate-500 font-medium">No hay estudiantes en este curso</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {asistencia.map((a) => (
                  <div key={a.studentId} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">
                        {a.studentName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{a.studentName}</p>
                        <p className="text-xs text-slate-400">{a.cedula}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {ESTADOS.map(est => {
                        const isActive = a.estado === est.value;
                        const Icon = est.icon;
                        return (
                          <button key={est.value} onClick={() => toggleEstado(a.studentId, est.value)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isActive
                                ? `${est.color} text-white shadow-sm`
                                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            }`}
                            title={est.label}>
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{est.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={32} className="text-slate-300" />
            </div>
            <p className="font-semibold text-slate-600">Selecciona un curso para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
}
