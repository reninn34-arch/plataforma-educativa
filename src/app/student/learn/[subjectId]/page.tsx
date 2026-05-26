"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Image as ImageIcon, Pencil } from "lucide-react";
import { SUBJECTS } from "@/lib/utils";
import { ImageCarousel } from "@/components/ImageCarousel";
import { ChatUI } from "@/components/ChatUI";
import { StudyMaterial } from "@/components/StudyMaterial";
import { Button } from "@/components/ui/button";

export default function LearnPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.subjectId as string;
  const subject = SUBJECTS.find((s) => s.id === subjectId) ?? SUBJECTS[0];

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-white/95 backdrop-blur shadow-sm">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/student/dashboard")} className="text-[#475569]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xl">{subject.emoji}</span>
            <div>
              <span className="text-base font-bold text-[#1A2332]">{subject.name}</span>
              <p className="text-xs text-[#94A3B8]">Sala de estudio</p>
            </div>
          </div>
          <Link href={`/student/practice/${subjectId}`}>
            <Button size="sm" className="gap-2 h-9 rounded-lg shadow-sm">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Practicar</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 max-w-7xl mx-auto w-full">

        {/* Left: Theory / Carousel */}
        <div className="flex-1 p-4 lg:border-r lg:border-[#E2E8F0] lg:overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="h-4 w-4 text-[#2B5F8E]" />
            <h2 className="text-sm font-semibold text-[#475569]">Material visual</h2>
          </div>
          <ImageCarousel subjectId={subjectId} />

          {/* AI Study Material */}
          <div className="mt-4">
            <StudyMaterial subjectId={subjectId} />
          </div>

          {/* Links to practice */}
          <div className="mt-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Notas de teoria</p>
            <p className="text-sm text-[#475569] leading-relaxed">
              El contenido teorico aparecera aqui generado por IA segun tu ritmo de aprendizaje.
              Desliza las imagenes del carrusel para repasar conceptos visuales clave.
            </p>
            <Link
              href={`/student/practice/${subjectId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent/80 transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Ir a la practica de {subject.name}
            </Link>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="flex-1 flex flex-col border-t border-[#E2E8F0] lg:border-t-0 lg:min-w-[400px]">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#2563EB]" />
              <h2 className="text-sm font-semibold text-[#475569]">Tutor Socratico</h2>
            </div>
            <Link
              href={`/student/practice/${subjectId}`}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Practicar
            </Link>
          </div>
          <div className="flex-1 h-[50vh] lg:h-[calc(100vh-3.5rem)]">
            <ChatUI subject={subject.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
