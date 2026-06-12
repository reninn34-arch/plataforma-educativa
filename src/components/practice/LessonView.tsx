"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn, formatNotation } from "@/lib/utils";
import { subjectTheme } from "@/lib/subject-theme";
import { sanitizeMermaid } from "@/lib/mermaid-validate";
import {
  BookOpen, Lightbulb, AlertTriangle,
  Check, X, ArrowRight, ArrowLeft, Target, Image, Loader2, Maximize2,
  ZoomIn, ZoomOut, RotateCcw, Play, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface ExampleStep {
  text: string;
  svg?: string;
}

interface VideoData {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
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
  videos?: VideoData[];
  videoSearchUrl?: string;
}

interface LessonViewProps {
  lesson: LessonData;
  onStartPractice: () => void;
  subjectSlug?: string;
  onRegenerateDiagram?: () => Promise<{ mermaid: string; caption: string } | null>;
}

function MermaidDiagram({ code, large, onRetry }: { code: string; large?: boolean; onRetry?: () => Promise<{ mermaid: string; caption: string } | null> }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [id] = useState(() => `mermaid-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(false);

    async function renderDiagram(codeToRender: string) {
      const mermaid = await import("mermaid");
      if (cancelled) return;
      mermaid.default.initialize({ startOnLoad: false, theme: "neutral" });
      const { svg: rendered } = await mermaid.default.render(id, codeToRender);
      if (!cancelled) setSvg(rendered);
    }

    const sanitized = sanitizeMermaid(code);
    renderDiagram(sanitized).catch(() => {
      if (!cancelled) setError(true);
    });

    return () => { cancelled = true; };
  }, [code, id]);

  if (error) return (
    <div className="flex flex-col items-center justify-center p-6 space-y-3">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <p className="text-sm text-amber-700 font-medium">No se pudo renderizar el diagrama</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Regenerar diagrama
        </button>
      )}
    </div>
  );
  if (!svg) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  return (
    <div
        className={cn(
          large ? "flex justify-center overflow-x-auto [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-none" : "flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
        )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function VideoSlide({ videos, videoSearchUrl }: { videos: VideoData[]; videoSearchUrl?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = videos[activeIndex];

  return (
    <div className="space-y-3 h-full overflow-y-auto">
      {/* Reproductor embed */}
      <div className="rounded-2xl overflow-hidden shadow-sm bg-black aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${active.id}?autoplay=0&rel=0`}
          title={active.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      {/* Info del video activo */}
      <div className="px-1 space-y-1">
        <p className="text-sm font-semibold text-foreground line-clamp-2">{active.title}</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{active.channelName} · {active.duration}</p>
          <a
            href={`https://www.youtube.com/watch?v=${active.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
          >
            Ver en YouTube <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Lista de videos disponibles */}
      {videos.length > 1 && (
        <div className="flex gap-2 px-0.5">
          {videos.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setActiveIndex(i)}
              className={`flex-1 rounded-xl overflow-hidden border-2 transition-all text-left ${
                i === activeIndex
                  ? "border-red-500 ring-1 ring-red-500"
                  : "border-border hover:border-border"
              }`}
            >
              <div className="relative aspect-video bg-black">
                {v.thumbnailUrl && (
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="h-4 w-4 text-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="p-1.5">
                <p className="text-xs font-medium text-foreground line-clamp-1">{v.title}</p>
                <p className="text-[10px] text-slate-400">{v.channelName}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {videoSearchUrl && (
        <div className="text-center pt-1">
          <a
            href={videoSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Ver más videos en YouTube sobre este tema
          </a>
        </div>
      )}
    </div>
  );
}

function DiagramView({ diagram, onRetry }: { diagram: NonNullable<LessonData["diagram"]>; onRetry?: () => Promise<{ mermaid: string; caption: string } | null> }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [retrying, setRetrying] = useState(false);
  const [currentDiagram, setCurrentDiagram] = useState(diagram);

  useEffect(() => { setCurrentDiagram(diagram); }, [diagram]);

  const handleRetry: () => Promise<{ mermaid: string; caption: string } | null> = async () => {
    if (!onRetry || retrying) return null;
    setRetrying(true);
    try {
      const result = await onRetry();
      if (result) setCurrentDiagram(result);
      return result;
    } finally {
      setRetrying(false);
    }
  };

  const renderContent = (large = false) => {
    if (retrying) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-sm text-blue-600 font-medium animate-pulse">Generando nuevo diagrama...</p>
        </div>
      );
    }
    if (currentDiagram.mermaid) {
      return <MermaidDiagram code={currentDiagram.mermaid} large={large} onRetry={handleRetry} />;
    }
    if (currentDiagram.svg) {
      return (
        <div
          className={cn(
            "overflow-x-auto",
            large
              ? "[&_svg]:max-w-full [&_svg]:max-h-[80vh] [&_svg]:h-auto"
              : "max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
          )}
          dangerouslySetInnerHTML={{ __html: currentDiagram.svg }}
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
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">{currentDiagram.caption}</span>
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
                {currentDiagram.caption}
              </DialogTitle>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"
                  title="Reducir zoom"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-xs font-mono text-foreground min-w-[40px] text-center tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors ml-1"
                  title="Restablecer zoom"
                >
                  <RotateCcw className="h-4 w-4" />
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
        <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Comprobación rápida</h3>
      </div>
      <p
        className="text-base font-semibold text-foreground leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatNotation(data.question) }}
      />
      <div className="grid gap-2.5">
        {data.options.map((opt, i) => {
          let stateClass = "border-border bg-card hover:border-amber-300 hover:bg-amber-50";
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
                "bg-muted text-muted-foreground"
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
              <p className="text-sm font-semibold text-foreground">
                {isCorrect ? "¡Correcto! Muy bien." : "No te preocupes, es parte del aprendizaje."}
              </p>
              <p
                className="text-sm text-muted-foreground leading-relaxed"
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

function generateFallbackSvg(stepIndex: number): string {
  const palette = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#FF8A5C', '#45B7D1'];
  const color = palette[stepIndex % palette.length];
  return `<svg viewBox='0 0 260 120' xmlns='http://www.w3.org/2000/svg'>
    <rect width='260' height='120' rx='12' fill='#f8f9fa'/>
    <rect x='10' y='10' width='240' height='100' rx='8' fill='${color}' opacity='0.12'/>
    <text x='130' y='52' text-anchor='middle' fill='${color}' font-size='28' font-weight='bold' font-family='system-ui'>Paso ${stepIndex + 1}</text>
    <line x1='90' y1='66' x2='170' y2='66' stroke='${color}' stroke-width='2' opacity='0.3'/>
    <circle cx='130' cy='82' r='4' fill='${color}' opacity='0.5'/>
    <circle cx='118' cy='82' r='3' fill='${color}' opacity='0.35'/>
    <circle cx='142' cy='82' r='3' fill='${color}' opacity='0.35'/>
  </svg>`;
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
        className="text-sm font-semibold text-foreground leading-relaxed mb-4"
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
                className="text-sm text-foreground leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: formatNotation(step.text) }}
              />
            </div>
            <div
              className="ml-0 sm:ml-9 rounded-xl bg-card border border-emerald-100 p-3 flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: step.svg || generateFallbackSvg(i) }}
            />
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

export function LessonView({ lesson, onStartPractice, subjectSlug, onRegenerateDiagram }: LessonViewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const prevSlideRef = useRef(currentSlide);
  const [exampleResetKey, setExampleResetKey] = useState(0);

  const theme = subjectTheme(subjectSlug || "");

  const slides = useMemo(() => {
    const s: { type: "explanation" | "video" | "diagram" | "example" | "commonMistake" | "quickCheck" | "ready" }[] = [
      { type: "explanation" },
    ];
    if (lesson.videos && lesson.videos.length > 0) s.push({ type: "video" });
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
    <div className="animate-fade-in-up space-y-4 pb-20">
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
        className="relative overflow-hidden rounded-2xl select-none h-[55dvh] min-h-[260px] sm:h-[58dvh] sm:min-h-[420px] w-full max-w-full overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-full w-full overflow-y-auto overflow-x-hidden">
          {/* Explanation slide */}
          {slides[currentSlide]?.type === "explanation" && (
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className={cn("bg-gradient-to-r px-6 py-4", theme.header)}>
                <h2 className="text-lg font-extrabold text-white">{lesson.title}</h2>
              </div>
              <div className="p-4 sm:p-6">
                <p
                  className="text-sm sm:text-base text-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatNotation(lesson.explanation) }}
                />
              </div>
            </div>
          )}

          {/* Video slide */}
          {slides[currentSlide]?.type === "video" && lesson.videos && lesson.videos.length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm">
              <div className="bg-gradient-to-r from-red-600 to-red-500 px-5 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="h-4 w-4" /> Vídeo explicativo
                </h3>
              </div>
              <div className="p-4">
                <VideoSlide videos={lesson.videos || []} videoSearchUrl={lesson.videoSearchUrl} />
              </div>
            </div>
          )}

          {/* Diagram slide */}
          {slides[currentSlide]?.type === "diagram" && lesson.diagram && (
            <DiagramView diagram={lesson.diagram} onRetry={onRegenerateDiagram} />
          )}

          {/* Example slide */}
          {slides[currentSlide]?.type === "example" && (
            <ExampleSlide
              key={exampleResetKey}
              lesson={lesson}
              onNextSlide={() => goTo(currentSlide + 1)}
            />
          )}

          {/* Common Mistake slide */}
          {slides[currentSlide]?.type === "commonMistake" && (
            <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider">Error común</h3>
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
          )}

          {/* Quick Check slide */}
          {slides[currentSlide]?.type === "quickCheck" && (
            <QuickCheck
              data={lesson.quickCheck}
              onComplete={() => goTo(currentSlide + 1)}
            />
          )}

          {/* Ready slide */}
          {slides[currentSlide]?.type === "ready" && (
            <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-white p-5 sm:p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[260px] sm:min-h-[300px] space-y-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Listo para practicar</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                  Has visto la teoría y los ejemplos. Ahora pon a prueba lo que aprendiste con ejercicios interactivos.
                </p>
              </div>
              <Button
                onClick={onStartPractice}
                size="lg"
                className="gap-2 px-8 text-base bg-emerald-600 hover:bg-emerald-700"
              >
                <Play className="h-5 w-5" /> Empezar práctica
              </Button>
              <button
                onClick={onStartPractice}
                className="text-xs text-slate-400 hover:text-muted-foreground underline transition-colors"
              >
                Omitir e ir directo a practicar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3">
        {canGoPrev ? (
          <button
            onClick={() => goTo(currentSlide - 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
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
