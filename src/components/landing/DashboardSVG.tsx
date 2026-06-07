"use client";

export function DashboardSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 380 320" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <style>{`
        @keyframes float-card {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes progress-grow {
          0% { width: 0; }
        }
        @keyframes ping-subtle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.3; }
        }
        @keyframes pulse-dot {
          0%, 100% { r: 2.5; opacity: 0.4; }
          50% { r: 3.5; opacity: 0.8; }
        }
        .dash-card { animation: float-card 4s ease-in-out infinite; }
        .dash-card-2 { animation: float-card 4s ease-in-out 0.5s infinite; }
        .dash-card-3 { animation: float-card 4s ease-in-out 1s infinite; }
        .dash-bar-1 { animation: progress-grow 1.2s ease-out 0.3s both; }
        .dash-bar-2 { animation: progress-grow 1.2s ease-out 0.5s both; }
        .dash-bar-3 { animation: progress-grow 1.2s ease-out 0.7s both; }
        .dash-ping { animation: ping-subtle 2s ease-in-out infinite; }
        .dash-online { animation: pulse-dot 2s ease-in-out infinite; }
      `}</style>

      <rect x="0" y="0" width="380" height="320" rx="18" fill="white" />

      <defs>
        <linearGradient id="dash-banner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="380" height="80" rx="18" fill="url(#dash-banner)" />
      <rect x="0" y="62" width="380" height="18" fill="url(#dash-banner)" />

      <rect x="380-80" y="20" width="80" height="40" rx="12" fill="white" fillOpacity="0.12" />

      <text x="20" y="32" fill="white" fontSize="13" fontWeight="700" fontFamily="sans-serif">Panel del Estudiante</text>
      <text x="20" y="52" fill="#C7D2FE" fontSize="12" fontWeight="700" fontFamily="sans-serif">¡Hola, Estudiante! 👋</text>
      <text x="20" y="67" fill="#A5B4FC" fontSize="10" fontFamily="sans-serif">Hoy es un gran día para empezar a practicar.</text>

      <rect x="290" y="18" width="74" height="22" rx="8" fill="white" fillOpacity="0.12" />
      <text x="298" y="32" fill="#E0E7FF" fontSize="10" fontWeight="700" fontFamily="sans-serif">📋 Ver tareas</text>

      <rect x="290" y="45" width="74" height="22" rx="8" fill="white" fillOpacity="0.12" />
      <text x="305" y="59" fill="#E0E7FF" fontSize="10" fontWeight="700" fontFamily="sans-serif">⚡ Practicar</text>

      <text x="20" y="106" fill="#1E293B" fontSize="14" fontWeight="800" fontFamily="sans-serif">Resumen académico</text>

      <rect x="20" y="115" width="75" height="48" rx="10" fill="#F8FAFC" />
      <rect x="48" y="124" width="16" height="16" rx="5" fill="#FED7AA" />
      <text x="46" y="138" fill="#EA580C" fontSize="9">🔥</text>
      <text x="34" y="153" fill="#1E293B" fontSize="14" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">3</text>
      <text x="44" y="161" fill="#64748B" fontSize="9" fontFamily="sans-serif">Racha</text>

      <rect x="103" y="115" width="75" height="48" rx="10" fill="#F8FAFC" />
      <rect x="131" y="124" width="16" height="16" rx="5" fill="#C7D2FE" />
      <text x="130" y="138" fill="#4F46E5" fontSize="9">⚡</text>
      <text x="118" y="153" fill="#1E293B" fontSize="14" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">12</text>
      <text x="128" y="161" fill="#64748B" fontSize="9" fontFamily="sans-serif">Sesiones</text>

      <rect x="186" y="115" width="75" height="48" rx="10" fill="#F8FAFC" />
      <rect x="213" y="124" width="16" height="16" rx="5" fill="#BBF7D0" />
      <text x="213" y="138" fill="#16A34A" fontSize="9">🎯</text>
      <text x="200" y="153" fill="#1E293B" fontSize="14" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">78%</text>
      <text x="210" y="161" fill="#64748B" fontSize="9" fontFamily="sans-serif">Precisión</text>

      <rect x="269" y="115" width="75" height="48" rx="10" fill="#F8FAFC" />
      <rect x="296" y="124" width="16" height="16" rx="5" fill="#DDD6FE" />
      <text x="296" y="138" fill="#7C3AED" fontSize="9">📚</text>
      <text x="283" y="153" fill="#1E293B" fontSize="14" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">4</text>
      <text x="293" y="161" fill="#64748B" fontSize="9" fontFamily="sans-serif">Materias</text>

      <rect x="20" y="175" width="220" height="64" rx="12" fill="#F8FAFC" />
      <rect x="20" y="175" width="220" height="64" rx="12" fill="#EEF2FF" />
      <rect x="32" y="188" width="44" height="44" rx="12" fill="#4F46E5" />
      <rect x="32" y="188" width="44" height="44" rx="12" fill="white" fillOpacity="0.2" className="dash-ping" />
      <text x="45" y="213" fill="white" fontSize="18">🧠</text>
      <text x="86" y="202" fill="#1E293B" fontSize="13" fontWeight="800" fontFamily="sans-serif">Práctica con IA</text>
      <text x="86" y="218" fill="#64748B" fontSize="10" fontFamily="sans-serif">4 materias · 24 nodos</text>
      <rect x="208" y="195" width="24" height="24" rx="8" fill="#4F46E5" />
      <text x="214" y="210" fill="white" fontSize="12">→</text>

      <text x="20" y="263" fill="#1E293B" fontSize="13" fontWeight="800" fontFamily="sans-serif">Tareas pendientes</text>

      <rect x="20" y="272" width="340" height="34" rx="8" fill="#F8FAFC" />
      <rect x="20" y="272" width="34" height="34" rx="8" fill="#FEF3C7" />
      <text x="30" y="293" fill="#D97706" fontSize="12">📋</text>
      <text x="62" y="283" fill="#334155" fontSize="11" fontWeight="700" fontFamily="sans-serif">Quiz Matemáticas</text>
      <text x="62" y="297" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">Matemáticas</text>
      <rect x="290" y="279" width="60" height="18" rx="6" fill="#FEF3C7" />
      <text x="296" y="291" fill="#D97706" fontSize="9" fontWeight="700" fontFamily="sans-serif">Queda 1 día</text>
    </svg>
  );
}
