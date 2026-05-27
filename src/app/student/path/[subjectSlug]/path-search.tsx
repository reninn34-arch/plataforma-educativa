"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PathSearchProps {
  subjectSlug: string;
  suggestedTopics: string[];
}

export function PathSearch({ subjectSlug, suggestedTopics }: PathSearchProps) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async (customTopic?: string) => {
    const query = (customTopic ?? topic).trim();
    if (!query || query.length < 3) {
      setError("Escribe al menos 3 caracteres.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/path/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subjectSlug, topic: query }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setTopic("");
        router.refresh();
      }
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-slate-400 shrink-0" />
        <h3 className="text-sm font-bold text-slate-700">Que quieres aprender hoy?</h3>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => { setTopic(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
          placeholder={`Ej: derivadas, verbos irregulares, celula...`}
          className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
          disabled={loading}
        />
        <Button
          onClick={() => handleGenerate()}
          disabled={loading || topic.trim().length < 3}
          className="rounded-xl gap-2 shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generar
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {suggestedTopics.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-2">Sugerencias rapidas:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedTopics.slice(0, 8).map((t) => (
              <button
                key={t}
                onClick={() => handleGenerate(t)}
                disabled={loading}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary border border-slate-200 transition-colors disabled:opacity-50"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
