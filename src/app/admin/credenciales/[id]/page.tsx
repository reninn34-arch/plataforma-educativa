"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/fetch-utils";

export default function CredencialesPage() {
  const params = useParams();
  const cursoId = params.id as string;

  const [curso, setCurso] = useState("");
  const [nivel, setNivel] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/admin/courses/${cursoId}/credentials`)
      .then(r => r.json())
      .then(d => {
        setCurso(d.curso || "");
        setNivel(d.nivel || "");
        setStudents(d.students || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cursoId]);

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="p-6 sm:p-8 w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Non-printable controls */}
      <div className="print:hidden flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Credenciales</h1>
        <Button onClick={handlePrint} className="gap-2 ml-auto">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>

      {/* Printable content */}
      <div className="print:block space-y-6">
        <div className="text-center border-b pb-6">
          <h1 className="text-3xl font-black text-foreground">ATLAS EDU</h1>
          <p className="text-lg font-bold text-muted-foreground mt-1">Credenciales de Acceso</p>
          <p className="text-sm text-muted-foreground mt-4">{curso} — {nivel}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Fecha de emision: {new Date().toLocaleDateString("es-EC")}
          </p>
        </div>

        <Card className="shadow-sm border-2">
          <CardContent className="p-0">
            <div className="divide-y">
              {students.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-foreground">{s.fullName}</p>
                    <p className="text-sm text-muted-foreground">{s.email || "Sin correo"}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-xs text-muted-foreground">Cedula / Usuario</div>
                    <p className="text-lg font-mono font-bold tracking-wide text-foreground">{s.cedula}</p>
                    <p className="text-[10px] text-muted-foreground">PIN: entregado por el administrador</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>Estas credenciales son personales e intransferibles</p>
          <p>En caso de perdida del PIN, contactar al administrador</p>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          header, nav, .lg\\:pl-64 { padding-left: 0 !important; }
          .pt-16 { padding-top: 0 !important; }
        }
      `}</style>
    </div>
  );
}
