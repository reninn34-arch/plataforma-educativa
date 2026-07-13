"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

const IMAGES: Record<string, string[]> = {
  matematicas: [
    "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&h=400&fit=crop&auto=format&q=80",
    "https://images.unsplash.com/photo-1509228468518-180b5e4bb3a7?w=600&h=400&fit=crop&auto=format&q=80",
    "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=600&h=400&fit=crop&auto=format&q=80",
  ],
  lenguaje: [
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&h=400&fit=crop&auto=format&q=80",
    "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=600&h=400&fit=crop&auto=format&q=80",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=400&fit=crop&auto=format&q=80",
  ],
  ciencias: [
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&h=400&fit=crop&auto=format&q=80",
    "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=600&h=400&fit=crop&auto=format&q=80",
    "https://images.unsplash.com/photo-1564325724739-b51b407c5108?w=600&h=400&fit=crop&auto=format&q=80",
  ],
  sociales: [
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&h=400&fit=crop&auto=format&q=80",
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&h=400&fit=crop&auto=format&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=400&fit=crop&auto=format&q=80",
  ],
};

const FALLBACKS = [
  "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&h=400&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&h=400&fit=crop&auto=format&q=80",
];

interface ImageCarouselProps {
  subjectId: string;
}

export function ImageCarousel({ subjectId }: ImageCarouselProps) {
  const images = IMAGES[subjectId] ?? FALLBACKS;
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + images.length) % images.length), [images.length]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-muted border border-border shadow-sm">
      <div className="relative aspect-[3/2] w-full">
        {images.map((src, i) => (
          <Image
            key={i}
            src={src}
            alt={`Teoria visual ${i + 1}`}
            fill
            className={`object-cover transition-opacity duration-500 ${
              i === current ? "opacity-100" : "opacity-0"
            }`}
            sizes="(max-width: 768px) 100vw, 600px"
            priority={i === 0}
          />
        ))}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

      {/* Caption */}
      <div className="absolute bottom-4 left-4">
        <p className="text-xs font-medium text-white/90 bg-black/40 backdrop-blur rounded-full px-3 py-1">
          Imagen {current + 1} de {images.length} &middot; Teoria visual
        </p>
      </div>

      {/* Nav arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-card/40 backdrop-blur text-[#1A2332] hover:bg-card/70 transition-all shadow-sm"
      >
        &#8249;
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-card/40 backdrop-blur text-[#1A2332] hover:bg-card/70 transition-all shadow-sm"
      >
        &#8250;
      </button>

      {/* Dots */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all ${
              i === current ? "w-6 bg-card" : "w-2 bg-card/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
