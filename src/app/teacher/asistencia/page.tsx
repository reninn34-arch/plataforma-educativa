"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, X, Clock, FileText, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [asistencia, setAsistencia] = useState<AsistenciaRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const { data: coursesData, isLoading: coursesLoading } = useQuery<CoursesData, Error>({
    queryKey: ["teacher-courses"],
    queryFn: async () => { const res = await apiFetch("/api/teacher/courses"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: asistenciaData, isLoading: asistenciaLoading, refetch: refetchAsistencia } = useQuery<AsistenciaData, Error>({
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
  const loading = coursesLoading || asistenciaLoading;

  if (cursos.length > 0 && !cursoId) setCursoId(cursos[0].id);

  const cambiarFecha = (dias: number) => {
    const f = new Date(fecha);
    f.setDate(f.getDate() + dias);
    setFecha(formatFecha(f));
  };

  const toggleEstado = (studentId: number, currentEstado: string) => {
    const estados = ["presente", "ausente", "tardanza", "justificado"];
    const idx = estados.indexOf(currentEstado === "pendiente" ? "presente" : currentEstado);
    const next = estados[(idx + 1) % estados.length];
    setAsistencia(prev => prev.map(a => a.studentId === studentId ? { ...a, estado: next } : a));
  };

  const guardarAsistencia = async () => {
    if (!cursoId) return;
    setSaving(true);
    try {
      const registros = asistencia.filter(a => a.estado !== "pendiente").map(a => ({ studentId: a.studentId, estado: a.estado }));
      if (registros.length === 0) { setFeedback("No hay cambios para guardar."); setSaving(false); return; }
      const res = await apiFetch("/api/teacher/asistencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cursoId, fecha, registros }) });
      if (res.ok) { setFeedback("Asistencia guardada correctamente."); setTimeout(() => setFeedback(""), 3000); }
      else { const d = await res.json(); setFeedback(d.error || "Error al guardar"); }
    } catch { setFeedback("Error de conexion"); }
    setSaving(false);
  };

  const marcarTodosPresente = () => { setAsistencia(prev => prev.map(a => ({ ...a, estado: "presente" }))); };

  const conteo = {
    presente: asistencia.filter(a => a.estado === "presente").length,
    ausente: asistencia.filter(a => a.estado === "ausente").length,
    tardanza: asistencia.filter(a => a.estado === "tardanza").length,
    justificado: asistencia.filter(a => a.estado === "justificado").length,
    pendiente: asistencia.filter(a => a.estado === "pendiente").length,
    total: asistencia.length,
  };

  const cursoSeleccionado = cursos.find(c => c.id === cursoId);

  return (
    <div className="flex-1 p-4 sm:p-8 w-full max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Control de Asistencia</h1>
          <p className="text-sm text-muted-foreground mt-1">Registra la asistencia diaria de tus estudiantes</p>
        </div>
      </div>

      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between ${feedback.startsWith("Error") ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
          <span>{feedback}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setFeedback("")}><X className="h-3 w-3" /></Button>
        </div>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Curso</label>
              <select value={cursoId || ""} onChange={e => setCursoId(e.target.value ? Number(e.target.value) : null)} className="h-9 rounded-lg border border-input bg-card px-3 text-sm min-w-[200px]">
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.nivel})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Fecha</label>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" onClick={() => cambiarFecha(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-3 text-sm" />
                <Button variant="outline" size="icon-sm" onClick={() => cambiarFecha(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={marcarTodosPresente} className="h-9 gap-1"><Check className="h-4 w-4" />Todos presentes</Button>
              <Button size="sm" onClick={guardarAsistencia} disabled={saving} className="h-9 gap-1">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar</Button>
            </div>
          </div>
          {conteo.total > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <Badge variant="default" className="text-xs gap-1"><Check className="h-3 w-3" /> {conteo.presente} presentes</Badge>
              <Badge variant="destructive" className="text-xs gap-1"><X className="h-3 w-3" /> {conteo.ausente} ausentes</Badge>
              <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 text-amber-700"><Clock className="h-3 w-3" /> {conteo.tardanza} tardanzas</Badge>
              <Badge variant="outline" className="text-xs gap-1">{conteo.justificado} justificados</Badge>
              {conteo.pendiente > 0 && <Badge variant="outline" className="text-xs text-muted-foreground">{conteo.pendiente} sin marcar</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : cursoSeleccionado ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{cursoSeleccionado.nombre} · {fechaLegible(fecha)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(asistenciaData?.asistencia || asistencia).length === 0 ? (
              <div className="py-16 text-center"><p className="text-muted-foreground">No hay estudiantes en este curso</p></div>
            ) : (
              <div className="divide-y">
                {(asistenciaData?.asistencia || asistencia).map((a) => (
                  <div key={a.studentId} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold">
                        {a.studentName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.studentName}</p>
                        <p className="text-xs text-muted-foreground">{a.cedula}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {ESTADOS.map(est => {
                        const isActive = a.estado === est.value;
                        const Icon = est.icon;
                        return (
                          <button key={est.value} onClick={() => toggleEstado(a.studentId, a.estado)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive ? `${est.color} text-white shadow-sm` : `bg-muted/50 ${est.textColor} hover:bg-muted`}`}
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
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm"><CardContent className="py-16 text-center"><p className="text-muted-foreground">Selecciona un curso para comenzar</p></CardContent></Card>
      )}
    </div>
  );
}