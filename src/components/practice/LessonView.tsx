"use client";

import { useState, useEffect, useRef } from "react";
import { cn, formatNotation } from "@/lib/utils";
import {
  BookOpen, Lightbulb, AlertTriangle, ChevronDown,
  ChevronUp, Check, X, ArrowRight, Target, Image, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LessonData {
  title: string;
  explanation: string;
  example: {
    problem: string;
    steps: string[];
    answer: string;
  };
  commonMistake: {
    description: string;
    correction: string;
  };
  diagram?: {
    mermaid?: string;
    svg?: string;
    caption: string;
  };
  quickCheck: {
    question: string;
    options: string[];
    correctIndex: number;
    feedback: string;
  };
}

interface LessonViewProps {
  lesson: LessonData;
  onStartPractice: () => void;
}

function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then((mermaid) => {
      if (cancelled) return;
      mermaid.default.initialize({ startOnLoad: false, theme: "neutral" });
      mermaid.default.render(idRef.current, code).then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      }).catch(() => {
        if (!cancelled) setError(true);
      });
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [code]);

  if (error) return <p className="text-sm text-red-500 p-4">No se pudo renderizar el diagrama</p>;
  if (!svg) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  return <div className="flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function DiagramView({ diagram }: { diagram: NonNullable<LessonData["diagram"]> }) {
  const [expanded, setExpanded] = useState(true);

  const renderContent = () => {
    if (diagram.mermaid) {
      return <MermaidDiagram code={diagram.mermaid} />;
    }
    if (diagram.svg) {
      return (
        <div
          className="max-w-full overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: diagram.svg }}
        />
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-blue-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">{diagram.caption}</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-blue-500" /> : <ChevronDown className="h-4 w-4 text-blue-500" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5">
          {renderContent()}
        </div>
      )}
    </div>
  );
}

function QuickCheck({ data, onComplete }: { data: LessonData["quickCheck"]; onComplete: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelected(index);
    setShowResult(true);
  };

  const isCorrect = selected === data.correctIndex;

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-amber-600" />
        <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Comprobacion rapida</h3>
      </div>
      <p
        className="text-base font-semibold text-slate-800 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatNotation(data.question) }}
      />
      <div className="grid gap-2.5">
        {data.options.map((opt, i) => {
          let stateClass = "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50";
          if (showResult && i === data.correctIndex) {
            stateClass = "border-emerald-500 bg-emerald-50";
          } else if (showResult && i === selected && !isCorrect) {
            stateClass = "border-red-400 bg-red-50";
          } else if (!showResult && i === selected) {
            stateClass = "border-amber-400 bg-amber-50";
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={showResult}
              className={cn(
                "flex items-center gap-3 w-full rounded-xl border-2 p-3.5 text-left text-sm font-medium transition-all",
                stateClass
              )}
            >
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                showResult && i === data.correctIndex ? "bg-emerald-500 text-white" :
                showResult && i === selected ? "bg-red-500 text-white" :
                "bg-slate-100 text-slate-500"
              )}>
                {showResult && i === data.correctIndex ? <Check className="h-3.5 w-3.5" /> :
                 showResult && i === selected && !isCorrect ? <X className="h-3.5 w-3.5" /> :
                 String.fromCharCode(65 + i)}
              </span>
              <span dangerouslySetInnerHTML={{ __html: formatNotation(opt) }} />
            </button>
          );
        })}
      </div>

      {showResult && (
        <div className={cn(
          "rounded-xl p-4 border animate-scale-in",
          isCorrect ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
        )}>
          <div className="flex items-start gap-2">
            {isCorrect ? (
              <Check className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            )}
            <div className="space-y-2 w-full">
              <p className="text-sm font-semibold text-slate-800">
                {isCorrect ? "Correcto! Muy bien." : "No te preocupes, es parte del aprendizaje."}
              </p>
              <p
                className="text-sm text-slate-600 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatNotation(data.feedback) }}
              />
              <Button
                onClick={onComplete}
                size="sm"
                className="w-full mt-1 gap-2"
              >
                Listo, a practicar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LessonView({ lesson, onStartPractice }: LessonViewProps) {
  return (
    <div className="animate-fade-in-up space-y-5 pb-24">
      {/* Title + Explanation */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-4">
          <h2 className="text-lg font-extrabold text-white">{lesson.title}</h2>
        </div>
        <div className="p-6 space-y-5">
          <p
            className="text-base text-slate-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatNotation(lesson.explanation) }}
          />
        </div>
      </div>

      {/* Diagram */}
      {lesson.diagram && (
        <DiagramView diagram={lesson.diagram} />
      )}

      {/* Example */}
      <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Ejemplo resuelto</h3>
        </div>
        <p
          className="text-sm font-semibold text-slate-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatNotation(lesson.example.problem) }}
        />
        <div className="space-y-2.5">
          {lesson.example.steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <p
                className="text-sm text-slate-700 leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: formatNotation(step) }}
              />
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-emerald-100/50 border border-emerald-200 px-4 py-2.5">
          <p
            className="text-sm font-bold text-emerald-800"
            dangerouslySetInnerHTML={{ __html: formatNotation(lesson.example.answer) }}
          />
        </div>
      </div>

      {/* Common Mistake */}
      <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider">Error comun</h3>
        </div>
        <div className="rounded-xl bg-red-100/50 border border-red-200 px-4 py-3">
          <p
            className="text-sm text-red-800 font-medium leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatNotation(lesson.commonMistake.description) }}
          />
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p
            className="text-sm text-emerald-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatNotation(lesson.commonMistake.correction) }}
          />
        </div>
      </div>

      {/* Quick Check */}
      <QuickCheck
        data={lesson.quickCheck}
        onComplete={onStartPractice}
      />

      {/* Skip button */}
      <div className="text-center">
        <button
          onClick={onStartPractice}
          className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
        >
          Omitir leccion e ir directo a practicar
        </button>
      </div>
    </div>
  );
}
