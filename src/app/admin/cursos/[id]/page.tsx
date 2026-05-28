"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, Loader2, X, UserPlus, Trash2, Printer, Mail, Users as UsersIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  const [cursoInfo, setCursoInfo] = useState<CursoInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<AvailableStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState("");
  const [resetPins, setResetPins] = useState(false);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState("");

  const fetchHorario = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/courses/${cursoId}/horarios`);
      const d = await res.json();
      const hor = d.horarios || [];
      setSchedule(hor.length > 0 ? hor : generateDefaultBlocks());
    } catch {}
  }, [cursoId]);

  const generateDefaultBlocks = () => {
    const dias = ["lunes", "martes", "miercoles", "jueves", "viernes"];
    const horas = ["07:00", "07:45", "08:30", "09:15", "10:00", "10:45", "11:30"];
    return dias.flatMap(dia =>
      horas.slice(0, -1).map((h, i) => ({
        dia,
        horaInicio: h,
        horaFin: horas[i + 1],
        subjectId: null,
        tipo: "clase",
        subjectEmoji: null,
        subjectName: null,
      }))
    );
  };

  const fetchCursoInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/courses");
      const d = await res.json();
      const found = (d.cursos || []).find((c: CursoInfo) => c.id === parseInt(cursoId));
      if (found) setCursoInfo(found);
    } catch {}
  }, [cursoId]);

  const handleSendEmails = async () => {
    setSendingEmail(true);
    setEmailFeedback("");
    try {
      const res = await fetch("/api/admin/credentials/email", {
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
      setEmailFeedback("Error de conexion");
    }
    setSendingEmail(false);
  };

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/courses/${cursoId}/students`);
      const d = await res.json();
      setStudents(d.students || []);
    } catch {}
  }, [cursoId]);

  useEffect(() => {
    fetchCursoInfo();
    fetchStudents();
    fetchHorario();
    fetch("/api/admin/users?role=student")
      .then(r => r.json()).then(d => setAllStudents(d.users || []))
      .catch(() => {});
    setLoading(false);
  }, [fetchCursoInfo, fetchStudents, cursoId]);

  const handleAddStudent = async (estudianteId: number) => {
    try {
      await fetch(`/api/admin/courses/${cursoId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estudianteId }),
      });
      fetchStudents();
      fetchCursoInfo();
    } catch {}
  };

  const handleRemoveStudent = async (estudianteId: number) => {
    try {
      await fetch(`/api/admin/courses/${cursoId}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estudianteId }),
      });
      fetchStudents();
      fetchCursoInfo();
    } catch {}
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
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/cursos")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{cursoInfo?.nombre || "Curso"}</h1>
          <p className="text-sm text-muted-foreground">
            {cursoInfo?.nivel}
            {cursoInfo && <span className="mx-2">·</span>}
            {students.length} estudiantes matriculados
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-1 cursor-pointer text-xs text-muted-foreground mr-2">
            <input type="checkbox" checked={resetPins} onChange={e => setResetPins(e.target.checked)} className="h-3.5 w-3.5 rounded border-input" />
            Resetear PINs
          </label>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSendEmails} disabled={sendingEmail}>
            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Enviar por correo
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push(`/admin/credenciales/${cursoId}`)}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4" /> Agregar estudiante
          </Button>
        </div>
      </div>

      {/* Course info card */}
      {cursoInfo && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <UsersIcon className="h-3 w-3" /> {cursoInfo.studentCount} estudiantes
                </Badge>
              </div>
              {cursoInfo.profesorNombre && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Tutor:</span>{" "}
                  <span className="font-medium">{cursoInfo.profesorNombre}</span>
                </div>
              )}
              {cursoInfo.teacherSubjects.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Profesores por materia:</span>
                  {cursoInfo.teacherSubjects.map((ts, i) => (
                    <Badge key={i} variant="outline" className="text-xs gap-1 py-1">
                      <span>{ts.subjectEmoji}</span>
                      <span>{ts.teacherName}</span>
                      <span className="text-muted-foreground">· {ts.subjectName}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {emailFeedback && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm font-medium text-blue-700">
          {emailFeedback}
        </div>
      )}

      {/* Add student panel */}
      {showAdd && (
        <Card className="shadow-sm animate-scale-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Agregar estudiantes al curso</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text" value={addSearch} onChange={e => setAddSearch(e.target.value)}
                placeholder="Buscar estudiante..."
                className="w-full h-10 pl-10 rounded-lg border border-input bg-card px-3 text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {availableFiltered.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.cedula}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAddStudent(s.id)}>Agregar</Button>
                </div>
              ))}
              {availableFiltered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay estudiantes disponibles</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar estudiante..."
          className="w-full h-10 pl-10 rounded-lg border border-input bg-card px-3 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredStudents.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
                      {s.fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.cedula}
                        {s.email && ` · ${s.email}`}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveStudent(s.estudianteId)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">No hay estudiantes en este curso</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {scheduleFeedback && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 flex items-center justify-between">
          <span>{scheduleFeedback}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setScheduleFeedback("")}><X className="h-3 w-3" /></Button>
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Horario Semanal</CardTitle>
            <Button
              size="sm"
              onClick={async () => {
                setScheduleSaving(true);
                try {
                  const bloques = schedule.map(b => ({
                    dia: b.dia,
                    horaInicio: b.horaInicio,
                    horaFin: b.horaFin,
                    subjectId: b.subjectId,
                    tipo: b.tipo,
                  }));
                  const res = await fetch(`/api/admin/courses/${cursoId}/horarios`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bloques }),
                  });
                  if (res.ok) {
                    setScheduleFeedback("Horario guardado correctamente.");
                  }
                } catch {}
                setScheduleSaving(false);
              }}
              disabled={scheduleSaving}
              className="gap-2"
            >
              {scheduleSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              Guardar horario
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-2 border bg-muted/50 text-left text-xs font-semibold text-muted-foreground">Hora</th>
                  {["lunes","martes","miercoles","jueves","viernes"].map(dia => (
                    <th key={dia} className="p-2 border bg-muted/50 text-center text-xs font-semibold text-muted-foreground capitalize">{dia.slice(0,3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(schedule.map(b => `${b.horaInicio}-${b.horaFin}`))].map(bloqueRaw => {
                  const [hInicio, hFin] = bloqueRaw.split("-");
                  return (
                    <tr key={bloqueRaw}>
                      <td className="p-1 border text-[10px] text-muted-foreground text-center font-mono whitespace-nowrap">
                        {hInicio}<br />{hFin}
                      </td>
                      {["lunes","martes","miercoles","jueves","viernes"].map(dia => {
                        const idx = schedule.findIndex(
                          b => b.dia === dia && b.horaInicio === hInicio && b.horaFin === hFin
                        );
                        if (idx === -1) return <td key={dia} className="p-1 border"></td>;
                        const b = schedule[idx];
                        return (
                          <td key={dia} className="p-1 border">
                            <select
                              value={b.tipo === "receso" ? "receso" : b.subjectId || ""}
                              onChange={e => {
                                const val = e.target.value;
                                const updated = [...schedule];
                                if (val === "receso") {
                                  updated[idx] = { ...updated[idx], tipo: "receso", subjectId: null };
                                } else if (val === "") {
                                  updated[idx] = { ...updated[idx], tipo: "clase", subjectId: null };
                                } else {
                                  updated[idx] = { ...updated[idx], tipo: "clase", subjectId: parseInt(val) };
                                }
                                setSchedule(updated);
                              }}
                              className="w-full h-8 text-[10px] rounded border border-input bg-card px-1"
                            >
                              <option value="">—</option>
                              <option value="receso">☕ Receso</option>
                              {cursoInfo?.teacherSubjects && cursoInfo.teacherSubjects.length > 0 && (
                                <optgroup label="Materias del curso">
                                  {[...new Map(cursoInfo.teacherSubjects.map(ts => [ts.subjectId, ts])).values()].map(ts => (
                                    <option key={ts.subjectId} value={ts.subjectId}>
                                      {ts.subjectEmoji} {ts.subjectName}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
