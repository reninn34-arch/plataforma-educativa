"use client";

import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, ChevronDown, BookOpen, GraduationCap, BarChart3 } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

interface CursoOption { id: number; nombre: string; nivel: string; }
interface CoursesData { cursos: CursoOption[]; }

interface MateriaReporte { nombre: string; emoji: string; promedio: number; calificaciones: number; }

interface StudentReport {
  id: number; nombre: string; promedioGeneral: number;
  totalTareas: number; entregadas: number; pendientes: number; materias: MateriaReporte[];
}

interface ReportData {
  curso: { id: number; nombre: string; nivel: string };
  subjects: { id: number; nombre: string; emoji: string }[];
  students: StudentReport[];
  stats: { totalEstudiantes: number; promedioCurso: number; totalTareas: number; totalMaterias: number };
}

function generatePdf(data: ReportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.text(`Reporte de Calificaciones - ${data.curso.nombre}`, 14, 20);

  doc.setFontSize(10);
  doc.text(`Nivel: ${data.curso.nivel}`, 14, 28);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES")}`, 14, 33);
  doc.text(`Total estudiantes: ${data.stats.totalEstudiantes} | Promedio del curso: ${data.stats.promedioCurso}`, 14, 38);

  const headers = [["#", "Estudiante", "Promedio", "Tareas", "Entregadas", "Pendientes"]];
  const rows = data.students.map((s, i) => [
    String(i + 1), s.nombre, s.promedioGeneral.toFixed(1),
    String(s.totalTareas), String(s.entregadas), String(s.pendientes),
  ]);

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 44,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  let yPos = (doc.lastAutoTable?.finalY || 50) + 10;

  for (const student of data.students) {
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    doc.setFontSize(11);
    doc.text(student.nombre, 14, yPos);
    yPos += 6;

    const subHeaders = [["Materia", "Promedio", "Calificaciones"]];
    const subRows = student.materias.map(m => [
      `${m.emoji} ${m.nombre}`, m.promedio.toFixed(1), String(m.calificaciones),
    ]);

    autoTable(doc, {
      head: subHeaders,
      body: subRows,
      startY: yPos,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    });

    yPos = (doc.lastAutoTable?.finalY || yPos + 20) + 6;
  }

  doc.save(`reporte-${data.curso.nombre.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

async function generateExcel(data: ReportData) {
  const wb = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet("Resumen");

  ws1.addRow(["Reporte de Calificaciones", data.curso.nombre]);
  ws1.addRow(["Nivel", data.curso.nivel]);
  ws1.addRow(["Fecha", new Date().toLocaleDateString("es-ES")]);
  ws1.addRow(["Total Estudiantes", String(data.stats.totalEstudiantes)]);
  ws1.addRow(["Promedio del Curso", String(data.stats.promedioCurso)]);
  ws1.addRow(["Total Materias", String(data.stats.totalMaterias)]);
  ws1.addRow(["Total Tareas", String(data.stats.totalTareas)]);
  ws1.addRow([]);
  ws1.addRow(["Estudiante", "Promedio General", "Tareas", "Entregadas", "Pendientes"]);

  for (const s of data.students) {
    ws1.addRow([s.nombre, String(s.promedioGeneral), String(s.totalTareas), String(s.entregadas), String(s.pendientes)]);
  }

  ws1.getColumn(1).width = 30;
  ws1.getColumn(2).width = 12;
  ws1.getColumn(3).width = 10;
  ws1.getColumn(4).width = 12;
  ws1.getColumn(5).width = 12;

  for (const student of data.students) {
    const ws = wb.addWorksheet(student.nombre.slice(0, 31));
    ws.addRow([`Calificaciones - ${student.nombre}`]);
    ws.addRow(["Materia", "Promedio", "Calificaciones"]);
    for (const m of student.materias) {
      ws.addRow([`${m.emoji} ${m.nombre}`, String(m.promedio), String(m.calificaciones)]);
    }
    ws.getColumn(1).width = 30;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 14;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte-${data.curso.nombre.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReportesContent() {
  const [cursoId, setCursoId] = useState<number | null>(null);

  const { data: coursesData } = useQuery<CoursesData, Error>({
    queryKey: ["cursos"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/courses");
      if (!res.ok) throw new Error("Error al cargar cursos");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, error } = useQuery<ReportData, Error>({
    queryKey: ["report-data", cursoId],
    queryFn: async () => {
      if (!cursoId) throw new Error("Selecciona un curso");
      const res = await apiFetch(`/api/reports/data?cursoId=${cursoId}`);
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      return res.json();
    },
    enabled: !!cursoId,
    staleTime: 2 * 60 * 1000,
  });

  const cursos = coursesData?.cursos || [];
  const cursoNombre = cursos.find(c => c.id === cursoId)?.nombre || "";
  const canExport = data && data.students.length > 0;

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const handleExportPdf = async () => {
    if (!data) return;
    setExportingPdf(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    generatePdf(data);
    setExportingPdf(false);
  };

  const handleExportExcel = async () => {
    if (!data) return;
    setExportingXlsx(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    await generateExcel(data);
    setExportingXlsx(false);
  };

  return (
    <div className="flex-1 w-full animate-fade-in-up overflow-x-hidden">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6">

        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-200/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-card/5 rounded-full blur-3xl" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-card/20 flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Reportes de Calificaciones</h1>
              <p className="text-emerald-100 mt-2 max-w-lg">Exporta boletines de calificaciones por curso en PDF o Excel</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={cursoId || ""}
              onChange={e => setCursoId(e.target.value ? Number(e.target.value) : null)}
              className="h-10 appearance-none rounded-2xl border border-border bg-card pl-4 pr-10 text-sm focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 focus:outline-none w-[220px]"
            >
              <option value="">Seleccionar curso...</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} - {c.nivel}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>

          {canExport && (
            <>
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="h-10 px-5 rounded-2xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
              >
                <FileText className="h-4 w-4" />
                {exportingPdf ? "Generando PDF..." : "Exportar PDF"}
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportingXlsx}
                className="h-10 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exportingXlsx ? "Generando Excel..." : "Exportar Excel"}
              </button>
            </>
          )}
        </div>

        {cursoId && isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-3 border-emerald-200 border-t-emerald-600 animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <p className="text-sm text-slate-400">Selecciona un curso para ver el reporte</p>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estudiantes</p>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <GraduationCap size={20} className="text-blue-500" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-foreground">{data.stats.totalEstudiantes}</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Promedio</p>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <BarChart3 size={20} className="text-emerald-500" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-foreground">{data.stats.promedioCurso}</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Materias</p>
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                    <BookOpen size={20} className="text-violet-500" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-foreground">{data.stats.totalMaterias}</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tareas</p>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Download size={20} className="text-amber-500" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-foreground">{data.stats.totalTareas}</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-foreground">Estudiantes - {data.curso.nombre}</h3>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 font-medium">#</th>
                      <th className="text-left py-2 font-medium">Estudiante</th>
                      <th className="text-center py-2 font-medium">Promedio</th>
                      <th className="text-center py-2 font-medium">Tareas</th>
                      <th className="text-center py-2 font-medium">Entregadas</th>
                      <th className="text-center py-2 font-medium">Pendientes</th>
                      <th className="text-center py-2 font-medium">Materias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s, i) => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 text-xs text-slate-400">{i + 1}</td>
                        <td className="py-2.5 text-xs font-medium text-foreground">{s.nombre}</td>
                        <td className="py-2.5 text-center">
                          <span className={`text-xs font-bold tabular-nums ${
                            s.promedioGeneral < 7 ? "text-red-500" : s.promedioGeneral < 8.5 ? "text-amber-500" : "text-green-500"
                          }`}>
                            {s.promedioGeneral.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-xs">{s.totalTareas}</td>
                        <td className="py-2.5 text-center text-xs">{s.entregadas}</td>
                        <td className="py-2.5 text-center text-xs">{s.pendientes}</td>
                        <td className="py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {s.materias.map((m, mi) => (
                              <span key={mi} title={`${m.nombre}: ${m.promedio}`} className="text-xs">{m.emoji}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {data.students.length > 0 && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-foreground">Desglose por estudiante</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {data.students.slice(0, 20).map(s => (
                    <details key={s.id} className="group">
                      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                            {s.nombre.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{s.nombre}</p>
                            <p className="text-[10px] text-slate-400">{s.materias.length} materias · {s.entregadas}/{s.totalTareas} tareas</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={s.promedioGeneral >= 7 ? "default" : "destructive"} className="text-xs rounded-lg">
                            {s.promedioGeneral.toFixed(1)}
                          </Badge>
                          <ChevronDown className="h-4 w-4 text-slate-300 group-open:rotate-180 transition-transform" />
                        </div>
                      </summary>
                      <div className="px-4 pb-4 pt-1">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-[10px] text-slate-400">
                              <th className="text-left py-1 font-medium">Materia</th>
                              <th className="text-center py-1 font-medium">Promedio</th>
                              <th className="text-center py-1 font-medium">Calificaciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.materias.map((m, mi) => (
                              <tr key={mi} className="border-b border-slate-50">
                                <td className="py-1.5 text-xs text-foreground">{m.emoji} {m.nombre}</td>
                                <td className="py-1.5 text-center text-xs font-bold tabular-nums">{m.promedio.toFixed(1)}</td>
                                <td className="py-1.5 text-center text-xs text-muted-foreground">{m.calificaciones}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminReportesPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-emerald-200 border-t-emerald-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Cargando reportes...</p>
        </div>
      </div>
    }>
      <ReportesContent />
    </Suspense>
  );
}
