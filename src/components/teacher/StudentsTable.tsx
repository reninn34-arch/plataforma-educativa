"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Search, ArrowDownUp, ChevronUp, ChevronDown,
  Users, AlertTriangle, CheckCircle2, BarChart3, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SemaforoRiesgo } from "@/components/SemaforoRiesgo";

interface StudentProgress {
  subjectId: number;
  subjectName: string;
  subjectEmoji: string;
  percentage: number;
  daysInactive: number;
  consecutiveFailures: number;
  lastActivity: string | null;
}

interface StudentData {
  id: number;
  fullName: string;
  cedula: string;
  email: string | null;
  cursoId: number;
  cursoNombre: string;
  progress: StudentProgress[];
}

interface StatsData {
  totalEstudiantes: number;
  enRiesgo: number;
  inactivos: number;
  promedio: number;
  totalCursos: number;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function getProgressColor(p: number) {
  if (p >= 70) return "bg-emerald-500";
  if (p >= 40) return "bg-primary";
  return "bg-amber-500";
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
  const [stats, setStats] = useState<StatsData>({ totalEstudiantes: 0, enRiesgo: 0, inactivos: 0, promedio: 0, totalCursos: 0 });
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
      fetch(`/api/teacher/stats${cursoId ? `?cursoId=${cursoId}` : ""}`).then(r => r.json()),
    ]).then(([sd, st]) => {
      setStudents(sd.students || []);
      setStats(st.totalEstudiantes !== undefined ? st : { totalEstudiantes: 0, enRiesgo: 0, inactivos: 0, promedio: 0, totalCursos: 0 });
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
    if (key === "progress") {
      return s.progress[0]?.percentage || 0;
    }
    if (key === "daysInactive") {
      return Math.min(...(s.progress.map(p => p.daysInactive).filter(d => d > 0)), 0);
    }
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
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">En Riesgo</p>
                <p className="text-2xl font-extrabold text-amber-600 tabular-nums">{stats.enRiesgo}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-red-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inactivos</p>
                <p className="text-2xl font-extrabold text-red-600 tabular-nums">{stats.inactivos}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-emerald-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Promedio</p>
                <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{stats.promedio}%</p>
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
                <TableHead><span className="text-xs font-semibold uppercase tracking-wider">Progreso</span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("daysInactive")}>
                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider">
                    Inactivo <SortIcon column="daysInactive" />
                  </span>
                </TableHead>
                <TableHead><span className="text-xs font-semibold uppercase tracking-wider">Riesgo</span></TableHead>
                <TableHead className="hidden md:table-cell"><span className="text-xs font-semibold uppercase tracking-wider">Ult. Actividad</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => {
                const bestProgress = s.progress.sort((a, b) => b.percentage - a.percentage)[0];
                const p = bestProgress || { percentage: 0, subjectEmoji: "📚", subjectName: "—", daysInactive: 0, consecutiveFailures: 0, lastActivity: null };
                const maxInactive = s.progress.length > 0 ? Math.max(...s.progress.map(pr => pr.daysInactive)) : 0;
                const maxFailures = s.progress.length > 0 ? Math.max(...s.progress.map(pr => pr.consecutiveFailures)) : 0;

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
                          <div className={cn("h-full rounded-full", getProgressColor(p.percentage))} style={{ width: `${p.percentage}%` }} />
                        </div>
                        <Badge variant="outline" className="text-[10px] gap-0.5 py-0">
                          <span>{p.subjectEmoji}</span> {p.percentage}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-medium", maxInactive >= 7 ? "text-destructive" : maxInactive >= 3 ? "text-amber-600" : "text-muted-foreground")}>
                        {maxInactive} {maxInactive === 1 ? "dia" : "dias"}
                      </span>
                    </TableCell>
                    <TableCell><SemaforoRiesgo daysInactive={maxInactive} consecutiveFailures={maxFailures} /></TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {daysAgo(p.lastActivity)}
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
