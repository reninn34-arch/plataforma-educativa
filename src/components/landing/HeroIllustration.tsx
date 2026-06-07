"use client";

export function HeroIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 360" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }
        @keyframes float-med {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-2deg); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(50px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(50px) rotate(-360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.05); }
        }
        @keyframes shimmer-slow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .hero-float-1 { animation: float-slow 5s ease-in-out infinite; }
        .hero-float-2 { animation: float-med 4.5s ease-in-out 0.5s infinite; }
        .hero-float-3 { animation: float-fast 3.5s ease-in-out 1s infinite; }
        .hero-pulse { animation: pulse-glow 3s ease-in-out infinite; }
        .hero-shimmer { animation: shimmer-slow 3s ease-in-out infinite; }
      `}</style>

      <defs>
        <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EEF2FF" />
          <stop offset="100%" stopColor="#FAF5FF" />
        </linearGradient>
        <linearGradient id="book-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="book-grad-2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="cap-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="400" height="360" rx="24" fill="url(#hero-bg)" />

      <circle cx="320" cy="60" r="100" fill="#C7D2FE" opacity="0.15" className="hero-pulse" />
      <circle cx="320" cy="60" r="70" fill="#A5B4FC" opacity="0.1" className="hero-pulse" style={{ animationDelay: "1s" }} />
      <circle cx="80" cy="300" r="80" fill="#DDD6FE" opacity="0.12" className="hero-pulse" style={{ animationDelay: "2s" }} />

      <line x1="60" y1="290" x2="340" y2="290" stroke="#E2E8F0" strokeWidth="1" />
      <line x1="60" y1="292" x2="180" y2="292" stroke="#C7D2FE" strokeWidth="1" />

      <g className="hero-float-1">
        <rect x="16" y="120" width="28" height="36" rx="4" fill="url(#book-grad)" />
        <rect x="14" y="118" width="28" height="36" rx="4" fill="url(#book-grad-2)" opacity="0.8" />
        <rect x="12" y="116" width="28" height="36" rx="4" fill="url(#book-grad)" opacity="0.9" />
        <line x1="22" y1="130" x2="30" y2="130" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="22" y1="136" x2="30" y2="136" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="22" y1="142" x2="28" y2="142" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      <g className="hero-float-2">
        <rect x="340" y="80" width="32" height="40" rx="4" fill="url(#book-grad-2)" />
        <rect x="338" y="78" width="32" height="40" rx="4" fill="url(#book-grad)" opacity="0.7" />
        <line x1="348" y1="94" x2="362" y2="94" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="348" y1="100" x2="360" y2="100" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="348" y1="106" x2="358" y2="106" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      <g className="hero-float-3">
        <rect x="340" y="190" width="36" height="28" rx="4" fill="#FDE68A" />
        <rect x="338" y="188" width="36" height="28" rx="4" fill="#F59E0B" opacity="0.9" />
        <text x="352" y="208" fill="white" fontSize="14" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">?</text>
      </g>

      <g className="hero-float-1" style={{ transformOrigin: "340px 270px" }}>
        <circle cx="340" cy="270" r="18" fill="#DCFCE7" />
        <text x="333" y="276" fontSize="16">📝</text>
      </g>

      <circle cx="200" cy="180" r="100" fill="white" className="hero-float-1" />
      <circle cx="200" cy="180" r="100" stroke="#E0E7FF" strokeWidth="2" />
      <circle cx="200" cy="180" r="85" fill="#F8FAFC" />

      <circle cx="200" cy="160" r="38" fill="#EEF2FF" />
      <circle cx="200" cy="160" r="36" fill="#E0E7FF" />
      <circle cx="200" cy="145" r="16" fill="#1E293B" />
      <circle cx="200" cy="145" r="14" fill="#334155" />
      <ellipse cx="200" cy="160" rx="12" ry="8" fill="#475569" />
      <circle cx="196" cy="143" r="2" fill="white" />
      <rect x="194" y="160" width="3" height="14" rx="1.5" fill="#1E293B" />
      <rect x="203" y="160" width="3" height="14" rx="1.5" fill="#1E293B" />

      <rect x="172" y="178" width="56" height="32" rx="4" fill="white" stroke="#4F46E5" strokeWidth="1.5" />
      <rect x="172" y="178" width="56" height="8" rx="4" fill="#4F46E5" />
      <line x1="180" y1="196" x2="220" y2="196" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="180" y1="202" x2="210" y2="202" stroke="#E2E8F0" strokeWidth="1.5" strokeLinecap="round" />

      <circle cx="82" cy="140" r="18" fill="#FEF3C7" className="hero-float-2" />
      <text x="75" y="146" fontSize="16">⭐</text>

      <circle cx="82" cy="220" r="16" fill="#FCE7F3" className="hero-float-3" />
      <text x="76" y="226" fontSize="14">💡</text>

      <circle cx="102" cy="240" r="14" fill="#E0E7FF" className="hero-float-2" style={{ animationDelay: "0.8s" }} />
      <text x="97" y="245" fontSize="11">⚛️</text>

      <rect x="290" y="144" width="60" height="20" rx="10" fill="#DCFCE7" className="hero-float-2" style={{ transformOrigin: "320px 154px" }} />
      <text x="300" y="158" fill="#16A34A" fontSize="9" fontWeight="700" fontFamily="sans-serif">✓ 78%</text>

      <rect x="294" y="200" width="56" height="20" rx="10" fill="#FEF3C7" className="hero-float-3" />
      <text x="300" y="214" fill="#D97706" fontSize="9" fontWeight="700" fontFamily="sans-serif">🔥 Racha 3</text>

      <rect x="20" y="300" width="80" height="6" rx="3" fill="#E2E8F0" />
      <rect x="20" y="300" width="50" height="6" rx="3" fill="#4F46E5" className="hero-shimmer" />

      <rect x="110" y="300" width="80" height="6" rx="3" fill="#E2E8F0" />
      <rect x="110" y="300" width="65" height="6" rx="3" fill="#10B981" className="hero-shimmer" style={{ animationDelay: "0.5s" }} />

      <rect x="200" y="300" width="80" height="6" rx="3" fill="#E2E8F0" />
      <rect x="200" y="300" width="35" height="6" rx="3" fill="#F59E0B" className="hero-shimmer" style={{ animationDelay: "1s" }} />
    </svg>
  );
}
