"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn, formatNotation } from "@/lib/utils";
import { subjectTheme } from "@/lib/subject-theme";
import {
  BookOpen, Lightbulb, AlertTriangle,
  Check, X, ArrowRight, ArrowLeft, Target, Image, Loader2, Maximize2,
  ZoomIn, ZoomOut, RotateCcw, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface ExampleStep {
  text: string;
  svg?: string;
}

interface LessonData {
  title: string;
  explanation: string;
  example: {
    problem: string;
    steps: ExampleStep[];
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
  subjectSlug?: string;
}

function MermaidDiagram({ code, large }: { code: string; large?: boolean }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [id] = useState(() => `mermaid-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then((mermaid) => {
      if (cancelled) return;
      mermaid.default.initialize({ startOnLoad: false, theme: "neutral" });
      mermaid.default.render(id, code).then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      }).catch(() => {
        if (!cancelled) setError(true);
      });
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [code, id]);

  if (error) return <p className="text-sm text-red-500 p-4">No se pudo renderizar el diagrama</p>;
  if (!svg) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  return (
    <div
      className={cn(
        "flex justify-center overflow-x-auto",
        large && "[&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-none"
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function DiagramView({ diagram }: { diagram: NonNullable<LessonData["diagram"]> }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const renderContent = (large = false) => {
    if (diagram.mermaid) {
      return <MermaidDiagram code={diagram.mermaid} large={large} />;
    }
    if (diagram.svg) {
      return (
        <div
          className={cn(
            "overflow-x-auto",
            large
              ? "[&_svg]:max-w-full [&_svg]:max-h-[80vh] [&_svg]:h-auto"
              : "max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
          )}
          dangerouslySetInnerHTML={{ __html: diagram.svg }}
        />
      );
    }
    return null;
  };

  return (
    <>
      <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 bg-blue-50/80">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">{diagram.caption}</span>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                setDialogOpen(true);
              }
            }}
            className="p-1 rounded-md hover:bg-blue-200/50 text-blue-500 transition-colors cursor-pointer"
            title="Ver en pantalla completa"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        </div>
        <div
          className="p-5 cursor-pointer flex items-center justify-center overflow-hidden"
          onClick={() => setDialogOpen(true)}
          title="Click para agrandar"
        >
          <div className="max-w-full max-h-full">
            {renderContent()}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[90vw] max-h-[95vh] flex flex-col" showCloseButton>
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-base font-bold text-blue-800 flex items-center gap-2 shrink-0">
                <Image className="h-4 w-4 text-blue-600" />
                {diagram.caption}
              </DialogTitle>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-600 transition-colors"
                  title="Reducir zoom"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-mono text-slate-700 min-w-[40px] text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-600 transition-colors"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-600 transition-colors ml-1"
                  title="Restablecer zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </DialogHeader>
          <div
            className="flex-1 overflow-auto min-h-0"
            onDoubleClick={() => setZoom(z => z === 1 ? 2 : 1)}
          >
            <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
              {renderContent(true)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
                className="w-full mt-2 gap-2"
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

function ExampleSlide({ lesson, onNextSlide }: { lesson: LessonData; onNextSlide: () => void }) {
  const [revealedSteps, setRevealedSteps] = useState(0);
  const steps = lesson.example.steps;
  const allRevealed = revealedSteps >= steps.length;

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-5 w-5 text-emerald-600" />
        <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Ejemplo resuelto</h3>
      </div>

      <p
        className="text-sm font-semibold text-slate-700 leading-relaxed mb-4"
        dangerouslySetInnerHTML={{ __html: formatNotation(lesson.example.problem) }}
      />

      <div className="space-y-3">
        {steps.slice(0, revealedSteps).map((step, i) => (
          <div key={i} className="space-y-2 animate-fade-in-up">
            <div className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <p
                className="text-sm text-slate-700 leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: formatNotation(step.text) }}
              />
            </div>
            {step.svg && (
              <div
                className="ml-9 rounded-xl bg-white border border-emerald-100 p-3 flex justify-center overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: step.svg }}
              />
            )}
          </div>
        ))}

        {allRevealed && (
          <div className="rounded-xl bg-emerald-100/50 border border-emerald-200 px-4 py-2.5 animate-fade-in-up mt-3">
            <p
              className="text-sm font-bold text-emerald-800"
              dangerouslySetInnerHTML={{ __html: formatNotation(lesson.example.answer) }}
            />
          </div>
        )}
      </div>

      {!allRevealed && (
        <button
          onClick={() => setRevealedSteps(r => Math.min(r + 1, steps.length))}
          className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-xl py-3 transition-colors"
        >
          Mostrar paso {revealedSteps + 1} <ArrowRight className="h-4 w-4" />
        </button>
      )}

      {allRevealed && (
        <Button onClick={onNextSlide} size="sm" className="mt-3 gap-2 w-full">
          Continuar <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function LessonView({ lesson, onStartPractice, subjectSlug }: LessonViewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const prevSlideRef = useRef(currentSlide);
  const [exampleResetKey, setExampleResetKey] = useState(0);

  const theme = subjectTheme(subjectSlug || "");

  const slides = useMemo(() => {
    const s: { type: "explanation" | "diagram" | "example" | "commonMistake" | "quickCheck" | "ready" }[] = [
      { type: "explanation" },
    ];
    if (lesson.diagram) s.push({ type: "diagram" });
    s.push({ type: "example" });
    s.push({ type: "commonMistake" });
    s.push({ type: "quickCheck" });
    s.push({ type: "ready" });
    return s;
  }, [lesson]);

  const exampleIndex = useMemo(() => slides.findIndex(s => s.type === "example"), [slides]);

  const totalSlides = slides.length;
  const canGoPrev = currentSlide > 0;
  const isLastSlide = currentSlide === totalSlides - 1;

  useEffect(() => {
    if (currentSlide === exampleIndex && prevSlideRef.current !== exampleIndex) {
      setExampleResetKey(k => k + 1);
    }
    prevSlideRef.current = currentSlide;
  }, [currentSlide, exampleIndex]);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= totalSlides) return;
    setCurrentSlide(index);
  }, [totalSlides]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const threshold = 60;
    if (touchDeltaX.current < -threshold) {
      goTo(currentSlide + 1);
    } else if (touchDeltaX.current > threshold) {
      goTo(currentSlide - 1);
    }
    touchDeltaX.current = 0;
  };

  return (
    <div className="animate-fade-in-up space-y-4 pb-24">
      {/* Progress bar + counter */}
      <div className="flex items-center justify-between px-1">
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === currentSlide
                  ? `w-6 ${theme.progress}`
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              )}
              aria-label={`Ir a diapositiva ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400 font-medium tabular-nums">
          {currentSlide + 1} de {totalSlides}
        </span>
      </div>

      {/* Carousel */}
      <div
        ref={carouselRef}
        className="relative overflow-hidden rounded-2xl select-none h-[65vh] min-h-[300px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {/* Explanation slide */}
          <div className="w-full flex-shrink-0 px-0.5 h-full overflow-y-auto">
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className={cn("bg-gradient-to-r px-6 py-4", theme.header)}>
                <h2 className="text-lg font-extrabold text-white">{lesson.title}</h2>
              </div>
              <div className="p-6">
                <p
                  className="text-base text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatNotation(lesson.explanation) }}
                />
              </div>
            </div>
          </div>

          {/* Diagram slide */}
          {lesson.diagram && (
            <div className="w-full flex-shrink-0 px-0.5 h-full overflow-y-auto">
              <DiagramView diagram={lesson.diagram} />
            </div>
          )}

          {/* Example slide */}
          <div className="w-full flex-shrink-0 px-0.5 h-full overflow-y-auto">
            <ExampleSlide
              key={exampleResetKey}
              lesson={lesson}
              onNextSlide={() => goTo(currentSlide + 1)}
            />
          </div>

          {/* Common Mistake slide */}
          <div className="w-full flex-shrink-0 px-0.5 h-full overflow-y-auto">
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
          </div>

          {/* Quick Check slide */}
          <div className="w-full flex-shrink-0 px-0.5 h-full overflow-y-auto">
            <QuickCheck
              data={lesson.quickCheck}
              onComplete={() => goTo(currentSlide + 1)}
            />
          </div>

          {/* Ready slide */}
          <div className="w-full flex-shrink-0 px-0.5 h-full overflow-y-auto">
            <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-white p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[300px] space-y-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Listo para practicar</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                  Has visto la teoria y los ejemplos. Ahora pon a prueba lo que aprendiste con ejercicios interactivos.
                </p>
              </div>
              <Button
                onClick={onStartPractice}
                size="lg"
                className="gap-2 px-8 text-base bg-emerald-600 hover:bg-emerald-700"
              >
                <Play className="h-5 w-5" /> Empezar practica
              </Button>
              <button
                onClick={onStartPractice}
                className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
              >
                Omitir e ir directo a practicar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3">
        {canGoPrev ? (
          <button
            onClick={() => goTo(currentSlide - 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors px-3 py-2"
          >
            <ArrowLeft className="h-4 w-4" /> Anterior
          </button>
        ) : (
          <div />
        )}

        {!isLastSlide && (
          <Button onClick={() => goTo(currentSlide + 1)} className={cn("gap-2 px-6 border-0", theme.primary)}>
            Siguiente <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
