"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";

interface CredentialsData {
  curso: string;
  nivel: string;
  students: { fullName: string; email: string | null; cedula: string; pin?: string | null }[];
}

export default function CredencialesPage() {
  const params = useParams();
  const cursoId = params.id as string;

  const [customData, setCustomData] = useState<CredentialsData | null>(null);
  const [resetting, setResetting] = useState(false);

  const { data, isLoading } = useQuery<CredentialsData, Error>({
    queryKey: ["admin-credentials", cursoId],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/courses/${cursoId}/credentials`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const displayData = customData || data;
  const curso = displayData?.curso || "";
  const nivel = displayData?.nivel || "";
  const students = displayData?.students || [];

  const handlePrint = () => window.print();

  const handleResetAndPrint = async () => {
    const confirmReset = window.confirm(
      "¡ATENCIÓN!\nEsta acción generará nuevos PINs aleatorios para todos los estudiantes de este curso y reemplazará las contraseñas actuales.\n¿Deseas continuar?"
    );
    if (!confirmReset) return;

    setResetting(true);
    try {
      const res = await apiFetch(`/api/admin/courses/${cursoId}/credentials`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Error al regenerar PINs");
        return;
      }
      setCustomData(d);
      setTimeout(() => {
        window.print();
      }, 500);
    } catch {
      alert("Error de conexión");
    } finally {
      setResetting(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
  );

  return (
    <div className="p-6 sm:p-8 w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="print:hidden flex flex-wrap items-center gap-4 border-b border-slate-200 pb-4">
        <button onClick={() => window.history.back()} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Credenciales de Acceso</h1>
          <p className="text-xs text-slate-500 mt-0.5">{curso} • {nivel}</p>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button onClick={handleResetAndPrint} variant="destructive" size="sm" className="gap-2 rounded-xl" disabled={resetting}>
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {resetting ? "Generando PINs..." : "Regenerar PINs e Imprimir"}
          </Button>
          <Button onClick={handlePrint} size="sm" className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200" disabled={resetting}>
            <Printer className="h-4 w-4" /> Imprimir plantilla
          </Button>
        </div>
      </div>

      <div className="print:block space-y-6">
        <div className="text-center border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-black text-slate-800">ATLAS EDU</h1>
          <p className="text-lg font-bold text-slate-500 mt-1">Credenciales de Acceso</p>
          <p className="text-sm text-slate-500 mt-4">{curso} — {nivel}</p>
          <p className="text-xs text-slate-400 mt-1">
            Fecha de emisión: {new Date().toLocaleDateString("es-EC")}
          </p>
        </div>

        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
          <div className="divide-y divide-slate-100">
            {students.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-slate-800">{s.fullName}</p>
                  <p className="text-sm text-slate-500">{s.email || "Sin correo"}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="text-xs text-slate-400">Cédula / Usuario</div>
                  <p className="text-lg font-mono font-bold tracking-wide text-slate-800">{s.cedula}</p>
                  <p className="text-xs font-mono font-bold text-slate-800">
                    PIN: {s.pin ? <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-2 py-0.5 text-sm">{s.pin}</span> : <span className="text-slate-400 italic text-[11px]">entregado por el administrador</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pt-4">
          <p>Estas credenciales son personales e intransferibles</p>
          <p>En caso de pérdida del PIN, contactar al administrador</p>
        </div>
      </div>

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
