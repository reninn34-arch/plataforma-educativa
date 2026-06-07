"use client";

export function PracticeGameSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 280" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <style>{`
        @keyframes float-game {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes bounce-in-q {
          0% { opacity: 0; transform: scale(0.8) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slide-opt {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes pop-feedback {
          0% { transform: scale(0); }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes heart-beat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes timer-tick {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -75; }
        }
        @keyframes shake-wrong {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        .game-float { animation: float-game 4s ease-in-out infinite; }
        .game-q { animation: bounce-in-q 0.5s ease-out 0.3s both; }
        .game-opt-1 { animation: slide-opt 0.4s ease-out 0.5s both; }
        .game-opt-2 { animation: slide-opt 0.4s ease-out 0.65s both; }
        .game-opt-3 { animation: slide-opt 0.4s ease-out 0.8s both; }
        .game-opt-4 { animation: slide-opt 0.4s ease-out 0.95s both; }
        .game-feedback { animation: pop-feedback 0.4s ease-out 1.2s both; }
        .game-heart { animation: heart-beat 1.5s ease-in-out infinite; }
        .game-timer { animation: timer-tick 8s linear infinite; }
        .game-shake { animation: shake-wrong 0.5s ease-out both; }
      `}</style>

      <rect x="20" y="16" width="24" height="24" rx="6" fill="#FCE7F3" className="game-heart" />
      <text x="26" y="33" fontSize="11">❤️</text>
      <rect x="50" y="16" width="24" height="24" rx="6" fill="#FCE7F3" className="game-heart" style={{ animationDelay: "0.2s" }} />
      <text x="56" y="33" fontSize="11">❤️</text>
      <rect x="80" y="16" width="24" height="24" rx="6" fill="#F1F5F9" />
      <text x="86" y="33" fontSize="11" opacity="0.3">❤️</text>

      <rect x="130" y="16" width="100" height="24" rx="6" fill="#EEF2FF" />
      <text x="140" y="32" fill="#4F46E5" fontSize="10" fontWeight="700" fontFamily="sans-serif">Pregunta 1 de 4</text>

      <rect x="255" y="14" width="30" height="28" rx="8" fill="#F1F5F9" />
      <svg x="258" y="17" width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="#CBD5E1" strokeWidth="2.5" fill="none" />
        <circle cx="12" cy="12" r="10" stroke="#4F46E5" strokeWidth="2.5" fill="none" strokeDasharray="62.8" className="game-timer" strokeLinecap="round" />
        <text x="12" y="16" fill="#1E293B" fontSize="8" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">30</text>
      </svg>

      <text x="170" y="70" fill="#1E293B" fontSize="13" fontWeight="800" fontFamily="sans-serif" textAnchor="middle" className="game-q">¿Cuál es el resultado de 2x + 5 = 15?</text>

      <rect x="20" y="86" width="300" height="36" rx="10" fill="#F8FAFC" className="game-opt-1" />
      <rect x="20" y="86" width="300" height="36" rx="10" stroke="#4F46E5" strokeWidth="2" fill="#EEF2FF" />
      <rect x="24" y="90" width="28" height="28" rx="7" fill="#4F46E5" />
      <text x="32" y="109" fill="white" fontSize="12" fontWeight="800" fontFamily="sans-serif">A</text>
      <text x="62" y="109" fill="#1E293B" fontSize="12" fontWeight="700" fontFamily="sans-serif">x = 5</text>
      <rect x="282" y="95" width="28" height="18" rx="6" fill="#DCFCE7" />
      <text x="288" y="108" fill="#16A34A" fontSize="10" fontWeight="800">✓</text>

      <rect x="20" y="130" width="300" height="36" rx="10" fill="#F8FAFC" className="game-opt-2" />
      <rect x="20" y="130" width="300" height="36" rx="10" stroke="#E2E8F0" strokeWidth="1" />
      <rect x="24" y="134" width="28" height="28" rx="7" fill="#F1F5F9" />
      <text x="32" y="153" fill="#64748B" fontSize="12" fontWeight="700" fontFamily="sans-serif">B</text>
      <text x="62" y="153" fill="#334155" fontSize="12" fontFamily="sans-serif">x = 10</text>

      <rect x="20" y="174" width="300" height="36" rx="10" fill="#F8FAFC" className="game-opt-3" />
      <rect x="20" y="174" width="300" height="36" rx="10" stroke="#E2E8F0" strokeWidth="1" />
      <rect x="24" y="178" width="28" height="28" rx="7" fill="#F1F5F9" />
      <text x="32" y="197" fill="#64748B" fontSize="12" fontWeight="700" fontFamily="sans-serif">C</text>
      <text x="62" y="197" fill="#334155" fontSize="12" fontFamily="sans-serif">x = 3</text>

      <rect x="20" y="218" width="300" height="36" rx="10" fill="#F8FAFC" className="game-opt-4" />
      <rect x="20" y="218" width="300" height="36" rx="10" stroke="#E2E8F0" strokeWidth="1" />
      <rect x="24" y="222" width="28" height="28" rx="7" fill="#F1F5F9" />
      <text x="32" y="241" fill="#64748B" fontSize="12" fontWeight="700" fontFamily="sans-serif">D</text>
      <text x="62" y="241" fill="#334155" fontSize="12" fontFamily="sans-serif">x = 20</text>

      <rect x="260" y="256" width="60" height="18" rx="6" fill="#DCFCE7" className="game-feedback" />
      <text x="266" y="268" fill="#16A34A" fontSize="9" fontWeight="700" fontFamily="sans-serif">✅ Correcto</text>

      <rect x="20" y="256" width="60" height="18" rx="6" fill="#F1F5F9" />
      <text x="26" y="268" fill="#64748B" fontSize="9" fontFamily="sans-serif">🔥 Combo ×1</text>
    </svg>
  );
}
