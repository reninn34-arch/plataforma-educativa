"use client";

import { useState } from "react";
import { Sparkles, Loader2, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatNotation } from "@/lib/utils";

export function StudyMaterial({ subjectId }: { subjectId: string }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/study-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subjectId }),
      });
      const data = await res.json();
      setContent(data.content || "");
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      {!content && !loading && (
        <Button onClick={generate} variant="outline" className="w-full gap-2 h-10">
          <Sparkles className="h-4 w-4 text-primary" />
          Generar material de estudio con IA
        </Button>
      )}

      {loading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-accent/50">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Generando contenido...</span>
        </div>
      )}

      {content && !loading && (
        <div className="animate-scale-in space-y-3">
          <Card aria-label="Material de estudio generado por IA" className="shadow-sm border-primary/20 bg-gradient-to-br from-primary/5 to-accent">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Material generado por IA</span>
              </div>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {content.split("\n").map((line, i) => {
                  if (line.startsWith("**") && line.includes("**")) {
                    const clean = line.replace(/\*\*/g, "");
                    return <h4 key={i} className="font-bold text-foreground mt-3 mb-1" dangerouslySetInnerHTML={{ __html: formatNotation(clean) }} />;
                  }
                  if (line.startsWith("-")) {
                    return <li key={i} className="ml-4 text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatNotation(line) }} />;
                  }
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatNotation(line) }} />;
                })}
              </div>
            </CardContent>
          </Card>
          <Button onClick={generate} variant="outline" size="sm" className="gap-2 text-xs">
            <Sparkles className="h-3 w-3" /> Regenerar
          </Button>
        </div>
      )}
    </div>
  );
}
