"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/fetch-utils";

interface Bloque {
  id: number;
  dia: string;
  horaInicio: string;
  horaFin: string;
  subjectName: string | null;
  subjectEmoji: string | null;
  tipo: string;
}

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"];
const DIAS_LABEL: Record<string, string> = {
  lunes: "Lun", martes: "Mar", miercoles: "Mie", jueves: "Jue", viernes: "Vie",
};

export default function StudentHorarioPage() {
  const [horarios, setHorarios] = useState<Bloque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/student/horario")
      .then(r => r.json())
      .then(d => { setHorarios(d.horarios || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const bloquesPorDia = (dia: string) => horarios.filter(h => h.dia === dia);

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin" /></div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4 max-w-6xl mx-auto w-full">
          <Link href="/student/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-bold text-foreground">Mi Horario</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full space-y-4 animate-fade-in-up">
        {horarios.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-16 text-center">
              <Clock className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-4 font-medium text-muted-foreground">Horario no disponible</p>
              <p className="text-sm text-muted-foreground mt-1">El administrador aun no ha configurado el horario.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="p-2 border bg-muted/50 text-left text-xs font-semibold text-muted-foreground">Hora</th>
                  {DIAS.map(dia => (
                    <th key={dia} className="p-2 border bg-muted/50 text-center text-xs font-semibold text-muted-foreground">
                      {DIAS_LABEL[dia]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(horarios.map(h => `${h.horaInicio}-${h.horaFin}`))].map(bloque => {
                  const [inicio, fin] = bloque.split("-");
                  return (
                    <tr key={bloque}>
                      <td className="p-2 border text-xs text-muted-foreground whitespace-nowrap font-medium">
                        {inicio}<br/>{fin}
                      </td>
                      {DIAS.map(dia => {
                        const b = horarios.find(h => h.dia === dia && `${h.horaInicio}-${h.horaFin}` === bloque);
                        if (!b) return <td key={dia} className="p-2 border"></td>;
                        if (b.tipo === "receso") {
                          return (
                            <td key={dia} className="p-2 border text-center">
                              <Badge variant="secondary" className="text-[10px]">☕ Receso</Badge>
                            </td>
                          );
                        }
                        return (
                          <td key={dia} className="p-2 border text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-lg">{b.subjectEmoji}</span>
                              <span className="text-[10px] font-medium">{b.subjectName}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
