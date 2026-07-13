"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, Loader2, X, UserPlus, Trash2, Printer, Mail, Users as UsersIcon, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/fetch-utils";

interface Student {
  id: number;
  estudianteId: number;
  cedula: string;
  fullName: string;
  email: string | null;
}

interface AvailableStudent {
  id: number;
  cedula: string;
  fullName: string;
}

interface CursoTeacherSubject {
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  subjectEmoji: string;
}

interface HorarioEntry {
  dia: string;
  horaInicio: string;
  horaFin: string;
  subjectId: number | null;
  tipo: string;
}

interface CursoInfo {
  id: number;
  nombre: string;
  nivel: string;
  profesorId: number | null;
  profesorNombre: string | null;
  activo: boolean;
  studentCount: number;
  teacherSubjects: CursoTeacherSubject[];
}

export default function CursoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cursoId = params.id as string;

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState("");
  const [resetPins, setResetPins] = useState(false);
  const [schedule, setSchedule] = useState<HorarioEntry[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState("");
  const [timeBlocks, setTimeBlocks] = useState<{ horaInicio: string; horaFin: string }[]>([
    { horaInicio: "07:00", horaFin: "07:45" },
    { horaInicio: "07:45", horaFin: "08:30" },
    { horaInicio: "08:30", horaFin: "09:15" },
    { horaInicio: "09:15", horaFin: "10:00" },
    { horaInicio: "10:00", horaFin: "10:45" },
    { horaInicio: "10:45", horaFin: "11:30" },
  ]);

  const queryClient = useQueryClient();

  interface CoursesResponse { cursos: CursoInfo[]; }
  interface StudentsResponse { students: Student[]; }
  interface HorariosResponse { horarios: HorarioEntry[]; }
  interface AllStudentsResponse { users: AvailableStudent[]; }

  const { data: coursesData } = useQuery<CoursesResponse, Error>({
    queryKey: ["admin-courses"],
    queryFn: async () => { const res = await apiFetch("/api/admin/courses"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: studentsData } = useQuery<StudentsResponse, Error>({
    queryKey: ["admin-course-students", cursoId],
    queryFn: async () => { const res = await apiFetch(`/api/admin/courses/${cursoId}/students`); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 2 * 60 * 1000,
  });

  const { data: horariosData } = useQuery<HorariosResponse, Error>({
    queryKey: ["admin-course-horarios", cursoId],
    queryFn: async () => { const res = await apiFetch(`/api/admin/courses/${cursoId}/horarios`); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 2 * 60 * 1000,
  });

  const { data: allStudentsData } = useQuery<AllStudentsResponse, Error>({
    queryKey: ["admin-users-student"],
    queryFn: async () => { const res = await apiFetch("/api/admin/users?role=student"); if (!res.ok) throw new Error(`API error: ${res.status}`); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const cursoInfo = coursesData?.cursos.find(c => c.id === parseInt(cursoId)) || null;
  const students = studentsData?.students || [];
  const allStudents = allStudentsData?.users || [];

  const loading = !coursesData && !studentsData;

  const prevHorariosRef = useRef(horariosData);
  useEffect(() => {
    if (horariosData?.horarios && horariosData.horarios.length > 0 && horariosData !== prevHorariosRef.current && schedule.length === 0) {
      prevHorariosRef.current = horariosData;
      const hor = horariosData.horarios;
      const seen = new Set<string>();
      const unique: { horaInicio: string; horaFin: string }[] = [];
      for (const h of hor) {
        const key = `${h.horaInicio}-${h.horaFin}`;
        if (!seen.has(key)) { seen.add(key); unique.push({ horaInicio: h.horaInicio, horaFin: h.horaFin }); }
      }
      const id = setTimeout(() => {
        setSchedule(hor);
        if (unique.length > 0) setTimeBlocks(unique);
      }, 0);
      return () => clearTimeout(id);
    }
  }, [horariosData, schedule.length]);

  const addTimeBlock = () => {
    setTimeBlocks([...timeBlocks, { horaInicio: "00:00", horaFin: "00:45" }]);
  };

  const handleCellChange = (dia: string, hi: string, hf: string, value: string) => {
    setSchedule(prev => {
      const idx = prev.findIndex(b => b.dia === dia && b.horaInicio === hi && b.horaFin === hf);
      if (idx >= 0) {
        const updated = [...prev];
        if (value === "receso") {
          updated[idx] = { ...updated[idx], tipo: "receso", subjectId: null };
        } else if (value === "") {
          updated[idx] = { ...updated[idx], tipo: "clase", subjectId: null };
        } else {
          updated[idx] = { ...updated[idx], tipo: "clase", subjectId: parseInt(value) };
        }
        return updated;
      } else if (value && value !== "") {
        return [...prev, { dia, horaInicio: hi, horaFin: hf, subjectId: value === "receso" ? null : parseInt(value), tipo: value === "receso" ? "receso" : "clase" }];
      }
      return prev;
    });
  };

  const removeTimeBlock = (idx: number) => {
    if (timeBlocks.length <= 1) return;
    const oldBlock = timeBlocks[idx];
    setTimeBlocks(prev => prev.filter((_, i) => i !== idx));
    setSchedule(prev => prev.filter(b => b.horaInicio !== oldBlock.horaInicio || b.horaFin !== oldBlock.horaFin));
  };

  const updateTimeBlock = (idx: number, field: "horaInicio" | "horaFin", value: string) => {
    const oldBlock = timeBlocks[idx];
    const updated = [...timeBlocks];
    updated[idx] = { ...updated[idx], [field]: value };
    setTimeBlocks(updated);
    setSchedule(prev => prev.map(b => {
      if (b.horaInicio === oldBlock.horaInicio && b.horaFin === oldBlock.horaFin) {
        return { ...b, [field]: value };
      }
      return b;
    }));
  };

  const getCellValue = (dia: string, hi: string, hf: string) => {
    const b = schedule.find(s => s.dia === dia && s.horaInicio === hi && s.horaFin === hf);
    if (!b) return "";
    if (b.tipo === "receso") return "receso";
    return b.subjectId ? String(b.subjectId) : "";
  };

  const handleSendEmails = async () => {
    setSendingEmail(true);
    setEmailFeedback("");
    try {
      const res = await apiFetch("/api/admin/credentials/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cursoId: parseInt(cursoId), resetPins }),
      });
      const d = await res.json();
      if (res.ok) {
        setEmailFeedback(`Correos enviados: ${d.sent}/${d.total}${d.pinsReset ? " (PINs restablecidos)" : ""}`);
        setResetPins(false);
      } else {
        setEmailFeedback(d.error || "Error al enviar");
      }
    } catch {
      setEmailFeedback("Error de conexión");
    }
    setSendingEmail(false);
  };

  const handleAddStudent = async (estudianteId: number) => {
    try {
      const res = await apiFetch(`/api/admin/courses/${cursoId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estudianteId }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Error al agregar estudiante");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-course-students", cursoId] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    } catch {
      alert("Error de conexión");
    }
  };

  const handleRemoveStudent = async (estudianteId: number) => {
    try {
      const res = await apiFetch(`/api/admin/courses/${cursoId}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estudianteId }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Error al quitar estudiante");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-course-students", cursoId] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    } catch {
      alert("Error de conexión");
    }
  };

  const enrolledIds = new Set(students.map(s => s.estudianteId));
  const availableFiltered = allStudents.filter(s =>
    !enrolledIds.has(s.id) &&
    (s.fullName.toLowerCase().includes(addSearch.toLowerCase()) || s.cedula.includes(addSearch))
  );

  const filteredStudents = students.filter(s =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) || s.cedula.includes(search)
  );

  return (
    <div className="p-6 sm:p-8 w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin/cursos")} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{cursoInfo?.nombre || "Curso"}</h1>
          <p className="text-sm text-slate-500">
            {cursoInfo?.nivel}
            {cursoInfo && <span className="mx-2">·</span>}
            {students.length} estudiantes matriculados
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-1 cursor-pointer text-xs text-slate-500 mr-2">
            <input type="checkbox" checked={resetPins} onChange={e => setResetPins(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-300" />
            Resetear PINs
          </label>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-slate-200" onClick={handleSendEmails} disabled={sendingEmail}>
            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Enviar por correo
          </Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-slate-200" onClick={() => router.push(`/admin/credenciales/${cursoId}`)}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button size="sm" className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4" /> Agregar estudiante
          </Button>
        </div>
      </div>

      {cursoInfo && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="secondary" className="text-xs flex items-center gap-1 rounded-lg">
              <UsersIcon className="h-3 w-3" /> {cursoInfo.studentCount} estudiantes
            </Badge>
            {cursoInfo.profesorNombre && (
              <div className="text-sm">
                <span className="text-slate-500">Tutor:</span>{" "}
                <span className="font-medium text-slate-700">{cursoInfo.profesorNombre}</span>
              </div>
            )}
            {cursoInfo.teacherSubjects.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">Profesores por materia:</span>
                {cursoInfo.teacherSubjects.map((ts, i) => (
                  <Badge key={i} variant="outline" className="text-xs gap-1 py-1 rounded-lg border-slate-200">
                    <span>{ts.subjectEmoji}</span>
                    <span>{ts.teacherName}</span>
                    <span className="text-slate-400">· {ts.subjectName}</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {emailFeedback && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm font-medium text-indigo-700">
          {emailFeedback}
        </div>
      )}

      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-scale-in">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Agregar estudiantes al curso</h2>
            <Button variant="ghost" size="icon-sm" onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></Button>
          </div>
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={addSearch} onChange={e => setAddSearch(e.target.value)}
                placeholder="Buscar estudiante..."
                className="w-full h-10 pl-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {availableFiltered.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.fullName}</p>
                    <p className="text-xs text-slate-400">{s.cedula}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAddStudent(s.id)} className="rounded-xl border-slate-200">Agregar</Button>
                </div>
              ))}
              {availableFiltered.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No hay estudiantes disponibles</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar estudiante..."
          className="w-full h-10 pl-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="divide-y divide-slate-100">
            {filteredStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                    {s.fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{s.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {s.cedula}
                      {s.email && ` · ${s.email}`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveStudent(s.estudianteId)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <div className="py-12 text-center">
                <UsersIcon className="mx-auto h-8 w-8 text-slate-300" />
                <p className="text-slate-400 mt-2">No hay estudiantes en este curso</p>
              </div>
            )}
          </div>
        </div>
      )}

      {scheduleFeedback && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 flex items-center justify-between">
          <span>{scheduleFeedback}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setScheduleFeedback("")} className="text-emerald-500"><X className="h-3 w-3" /></Button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-500" /> Horario Semanal
              </h2>
              <Button type="button" variant="outline" size="sm" onClick={addTimeBlock} className="gap-1 text-xs h-7 rounded-xl border-slate-200">
                + Agregar hora
              </Button>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                setScheduleSaving(true);
                try {
                  const bloques = schedule.map(b => ({
                    dia: b.dia, horaInicio: b.horaInicio, horaFin: b.horaFin,
                    subjectId: b.subjectId, tipo: b.tipo,
                  }));
                  await apiFetch(`/api/admin/courses/${cursoId}/horarios`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bloques }),
                  });
                  setScheduleFeedback("Horario guardado correctamente.");
                } catch {}
                setScheduleSaving(false);
              }}
              disabled={scheduleSaving}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 gap-2"
            >
              {scheduleSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              Guardar horario
            </Button>
          </div>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-2 border border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500 w-24">Hora</th>
                  {["lunes","martes","miercoles","jueves","viernes"].map(dia => (
                    <th key={dia} className="p-2 border border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500 capitalize">{dia.slice(0,3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeBlocks.map((tb, tIdx) => (
                  <tr key={`${tb.horaInicio}-${tb.horaFin}-${tIdx}`}>
                    <td className="p-1 border border-slate-200">
                      <div className="flex items-center gap-1">
                        <input type="time" value={tb.horaInicio}
                          onChange={e => updateTimeBlock(tIdx, "horaInicio", e.target.value)}
                          className="w-full h-7 text-[10px] rounded-lg border border-slate-200 bg-white px-1 text-center focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
                        <span className="text-[10px] text-slate-400">—</span>
                        <input type="time" value={tb.horaFin}
                          onChange={e => updateTimeBlock(tIdx, "horaFin", e.target.value)}
                          className="w-full h-7 text-[10px] rounded-lg border border-slate-200 bg-white px-1 text-center focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" />
                        {timeBlocks.length > 1 && (
                          <button onClick={() => removeTimeBlock(tIdx)} className="text-slate-400 hover:text-red-500 shrink-0 ml-1">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    {["lunes","martes","miercoles","jueves","viernes"].map(dia => (
                      <td key={dia} className="p-1 border border-slate-200">
                        <select value={getCellValue(dia, tb.horaInicio, tb.horaFin)}
                          onChange={e => handleCellChange(dia, tb.horaInicio, tb.horaFin, e.target.value)}
                          className="w-full h-7 text-[10px] rounded-lg border border-slate-200 bg-white px-1 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
                          <option value="">—</option>
                          <option value="receso">☕ Receso</option>
                          {cursoInfo?.teacherSubjects && [...new Map(cursoInfo.teacherSubjects.map(ts => [ts.subjectId, ts])).values()].map(ts => (
                            <option key={ts.subjectId} value={ts.subjectId}>
                              {ts.subjectEmoji} {ts.subjectName}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
