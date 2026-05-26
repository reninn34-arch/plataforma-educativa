"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search, ArrowDownUp, ChevronUp, ChevronDown,
  Users, AlertTriangle, CheckCircle2, Phone, BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SemaforoRiesgo } from "@/components/SemaforoRiesgo";

interface Student {
  id: number;
  cedula: string;
  fullName: string;
  subject: string;
  progress: number;
  daysInactive: number;
  consecutiveFailures: number;
  lastActivity: string;
  phone?: string;
}

const MOCK_STUDENTS: Student[] = [
  { id: 1, cedula: "1723456789", fullName: "Maria Elena Guaman", subject: "Matematicas", progress: 72, daysInactive: 1, consecutiveFailures: 0, lastActivity: "Hoy, 10:30", phone: "0998765432" },
  { id: 2, cedula: "1712345678", fullName: "Jose Luis Quishpe", subject: "Lenguaje", progress: 35, daysInactive: 4, consecutiveFailures: 3, lastActivity: "20 May 2026", phone: "0987654321" },
  { id: 3, cedula: "1709876543", fullName: "Ana Lucia Paredes", subject: "Ciencias", progress: 88, daysInactive: 0, consecutiveFailures: 0, lastActivity: "Hoy, 14:15", phone: "0976543210" },
  { id: 4, cedula: "1721345678", fullName: "Carlos Andres Toapanta", subject: "Sociales", progress: 51, daysInactive: 2, consecutiveFailures: 1, lastActivity: "23 May 2026", phone: "0965432109" },
  { id: 5, cedula: "1713456789", fullName: "Rosa Elena Tipan", subject: "Matematicas", progress: 12, daysInactive: 8, consecutiveFailures: 6, lastActivity: "15 May 2026", phone: "0954321098" },
  { id: 6, cedula: "1732145678", fullName: "Luis Miguel Chicaiza", subject: "Lenguaje", progress: 44, daysInactive: 2, consecutiveFailures: 0, lastActivity: "24 May 2026" },
  { id: 7, cedula: "1714567890", fullName: "Diana Carolina Mena", subject: "Ciencias", progress: 95, daysInactive: 0, consecutiveFailures: 0, lastActivity: "Hoy, 09:00" },
  { id: 8, cedula: "1721456789", fullName: "Pedro Pablo Tupiza", subject: "Sociales", progress: 28, daysInactive: 6, consecutiveFailures: 4, lastActivity: "17 May 2026" },
];

type SortKey = keyof Student;
type SortDir = "asc" | "desc";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function getProgressColor(p: number) {
  if (p >= 70) return "bg-emerald-500";
  if (p >= 40) return "bg-primary";
  return "bg-amber-500";
}

export function StudentsTable() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = MOCK_STUDENTS
    .filter((s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.cedula.includes(search) ||
      s.subject.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const dir = sortDir === "asc" ? 1 : -1;
      if (typeof aVal === "string" && typeof bVal === "string") return aVal.localeCompare(bVal) * dir;
      return ((aVal as number) - (bVal as number)) * dir;
    });

  const stats = {
    total: MOCK_STUDENTS.length,
    enRiesgo: MOCK_STUDENTS.filter((s) => s.daysInactive >= 3 || s.consecutiveFailures >= 3).length,
    activos: MOCK_STUDENTS.filter((s) => s.daysInactive <= 1 && s.consecutiveFailures <= 0).length,
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowDownUp className="ml-1 h-3 w-3 text-muted-foreground/40" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="ml-1 h-3.5 w-3.5 text-primary" />;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-l-[3px] border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estudiantes</p>
                <p className="text-2xl font-extrabold text-foreground tabular-nums">{stats.total}</p>
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
        <Card className="border-l-[3px] border-l-emerald-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Activos</p>
                <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">{stats.activos}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, cedula o materia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-card text-sm"
          />
        </div>
      </div>

      {/* Table */}
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
                <TableHead><span className="text-xs font-semibold uppercase tracking-wider">Materia</span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("progress")}>
                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider">
                    Progreso <SortIcon column="progress" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("daysInactive")}>
                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider">
                    Inactivo <SortIcon column="daysInactive" />
                  </span>
                </TableHead>
                <TableHead><span className="text-xs font-semibold uppercase tracking-wider">Estado</span></TableHead>
                <TableHead className="hidden md:table-cell"><span className="text-xs font-semibold uppercase tracking-wider">Ult. Actividad</span></TableHead>
                <TableHead><span className="text-xs font-semibold uppercase tracking-wider">Accion</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                        {getInitials(s.fullName)}
                      </div>
                      <span className="font-semibold text-foreground text-sm">{s.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.cedula}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal">{s.subject}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", getProgressColor(s.progress))} style={{ width: `${s.progress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground tabular-nums w-8">{s.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-sm font-medium", s.daysInactive >= 7 ? "text-destructive" : s.daysInactive >= 3 ? "text-amber-600" : "text-muted-foreground")}>
                      {s.daysInactive} {s.daysInactive === 1 ? "dia" : "dias"}
                    </span>
                  </TableCell>
                  <TableCell><SemaforoRiesgo daysInactive={s.daysInactive} consecutiveFailures={s.consecutiveFailures} /></TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{s.lastActivity}</TableCell>
                  <TableCell>
                    {s.phone ? (
                      <a href={`https://wa.me/593${s.phone.slice(1)}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                        <Phone className="h-3 w-3" /> WhatsApp
                      </a>
                    ) : <span className="text-[11px] text-muted-foreground/50">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 font-medium text-muted-foreground">No se encontraron estudiantes</p>
          </div>
        )}
      </Card>
    </div>
  );
}
