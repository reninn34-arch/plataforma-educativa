"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, ArrowDownUp, ChevronUp, ChevronDown,
  Users, AlertTriangle, CheckCircle2, BarChart3, Loader2, TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SemaforoRiesgo } from "@/components/SemaforoRiesgo";

interface StudentGrades {
  average: number | null;
  pending: number;
  lastSubmission: string | null;
}

interface StudentData {
  id: number;
  fullName: string;
  cedula: string;
  email: string | null;
  cursoId: number;
  cursoNombre: string;
  grades: StudentGrades;
}

interface StatsData {
  totalEstudiantes: number;
  pendientes: number;
  bajoRendimiento: number;
  promedioGeneral: number;
  totalCursos: number;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function getGradeColor(p: number) {
  if (p >= 7) return "bg-emerald-500";
  if (p >= 5) return "bg-primary";
  return "bg-red-500";
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "1 dia";
  return `${diff} dias`;
}

export function StudentsTable({ cursoId }: { cursoId?: number | null }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentData[]>([]);
  const [stats, setStats] = useState<StatsData>({ totalEstudiantes: 0, pendientes: 0, bajoRendimiento: 0, promedioGeneral: 0, totalCursos: 0 });
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>("fullName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cursoId) params.set("cursoId", String(cursoId));
    if (search) params.set("search", search);

    Promise.all([
      fetch(`/api/teacher/students?${params}`).then(r => r.json()),
      fetch(`/api/teacher/academic-stats${cursoId ? `?cursoId=${cursoId}` : ""}`).then(r => r.json()),
    ]).then(([sd, st]) => {
      setStudents(sd.students || []);
      setStats(st.totalEstudiantes !== undefined ? st : { totalEstudiantes: 0, pendientes: 0, bajoRendimiento: 0, promedioGeneral: 0, totalCursos: 0 });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cursoId, search]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const getSortValue = (s: StudentData, key: string): number | string => {
    if (key === "average") return s.grades.average ?? 0;
    if (key === "pending") return s.grades.pending;
    if (key === "fullName") return s.fullName;
    if (key === "cedula") return s.cedula;
    return 0;
  };

  const sorted = [...students].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    const dir = sortDir === "asc" ? 1 : -1;
    if (typeof aVal === "string" && typeof bVal === "string") return aVal.localeCompare(bVal) * dir;
    return ((aVal as number) - (bVal as number)) * dir;
  });

  const SortIcon = ({ column }: { column: string }) => {
    if (sortKey !== column) return <ArrowDownUp className="ml-1 h-3 w-3 text-muted-foreground/40" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="ml-1 h-3.5 w-3.5 text-primary" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-[3px] border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Alumnos</p>
                <p className="text-2xl font-extrabold text-foreground tabular-nums">{stats.totalEstudiantes}</p>
              </div>
              <Users className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-amber-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{stats.pendientes}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-red-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bajo prom.</p>
                <p className="text-2xl font-extrabold text-red-600 tabular-nums">{stats.bajoRendimiento}</p>
              </div>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-emerald-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prom. General</p>
                <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{stats.promedioGeneral}%</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nombre o cedula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-card text-sm"
        />
      </div>

      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("fullName")}>
                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider">
                    Estudiante <SortIcon column="fullName" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("cedula")}>
                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider">
                    Cedula <SortIcon column="cedula" />
                  </span>
                </TableHead>
                {!cursoId && (
                  <TableHead><span className="text-xs font-semibold uppercase tracking-wider">Curso</span></TableHead>
                )}
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("average")}>
                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider">
                    Nota <SortIcon column="average" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("pending")}>
                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider">
                    Pend. <SortIcon column="pending" />
                  </span>
                </TableHead>
                <TableHead><span className="text-xs font-semibold uppercase tracking-wider">Riesgo</span></TableHead>
                <TableHead className="hidden md:table-cell"><span className="text-xs font-semibold uppercase tracking-wider">Ult. Entrega</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => {
                const avg = s.grades.average;
                const gradePercent = avg !== null ? Math.round(avg * 10) : 0;
                const riskDaysInactive = s.grades.lastSubmission
                  ? Math.floor((Date.now() - new Date(s.grades.lastSubmission).getTime()) / (1000 * 60 * 60 * 24))
                  : 999;
                const riskFailures = avg !== null && avg < 7 ? 5 : 0;

                return (
                  <TableRow key={s.id + "-" + s.cursoId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                          {getInitials(s.fullName)}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground text-sm">{s.fullName}</span>
                          {s.email && <p className="text-[10px] text-muted-foreground">{s.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.cedula}</TableCell>
                    {!cursoId && (
                      <TableCell><Badge variant="secondary" className="text-[10px]">{s.cursoNombre}</Badge></TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", getGradeColor(gradePercent / 10))} style={{ width: `${gradePercent}%` }} />
                        </div>
                        <Badge variant={avg !== null && avg >= 7 ? "default" : avg !== null ? "destructive" : "outline"} className="text-[10px]">
                          {avg !== null ? avg.toFixed(1) : "—"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-medium", s.grades.pending > 0 ? "text-amber-600" : "text-muted-foreground")}>
                        {s.grades.pending > 0 ? `${s.grades.pending} tarea${s.grades.pending > 1 ? "s" : ""}` : "Al dia"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <SemaforoRiesgo daysInactive={riskDaysInactive} consecutiveFailures={riskFailures} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {daysAgo(s.grades.lastSubmission)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {sorted.length === 0 && (
          <div className="py-20 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 font-medium text-muted-foreground">No se encontraron estudiantes</p>
          </div>
        )}
      </Card>
    </div>
  );
}
