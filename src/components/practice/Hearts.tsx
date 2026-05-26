"use client";

export function Hearts({ lives, maxLives }: { lives: number; maxLives: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxLives }).map((_, i) => (
        <span
          key={i}
          className={`text-lg transition-all duration-300 ${
            i < lives
              ? "opacity-100 scale-100"
              : "opacity-25 scale-75 grayscale"
          }`}
        >
          {i < lives ? "❤️" : "🤍"}
        </span>
      ))}
    </div>
  );
}
