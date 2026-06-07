"use client";

export function TutorChatSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <style>{`
        @keyframes slide-up-msg {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes typing-dot {
          0%, 100% { transform: translateY(0); opacity: 0.3; }
          50% { transform: translateY(-5px); opacity: 0.8; }
        }
        @keyframes pulse-avatar {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79,70,229,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(79,70,229,0); }
        }
        .tutor-msg-1 { animation: slide-up-msg 0.5s ease-out 0.2s both; }
        .tutor-msg-2 { animation: slide-up-msg 0.5s ease-out 0.7s both; }
        .tutor-msg-3 { animation: slide-up-msg 0.5s ease-out 1.2s both; }
        .tutor-dot { animation: typing-dot 1s ease-in-out infinite; }
        .tutor-dot:nth-child(2) { animation-delay: 0.15s; }
        .tutor-dot:nth-child(3) { animation-delay: 0.3s; }
      `}</style>

      <rect x="0" y="0" width="320" height="280" rx="16" fill="white" />

      <rect x="0" y="0" width="320" height="48" rx="16" fill="#4F46E5" />
      <rect x="0" y="32" width="320" height="16" fill="#4F46E5" />

      <rect x="14" y="12" width="26" height="24" rx="8" fill="#6366F1" />
      <text x="21" y="29" fill="white" fontSize="13">🧠</text>
      <text x="48" y="30" fill="white" fontSize="13" fontWeight="800" fontFamily="sans-serif">Tutor de Aprendizaje</text>
      <text x="48" y="40" fill="#A5B4FC" fontSize="9" fontFamily="sans-serif">Método socrático</text>

      <circle cx="30" cy="68" r="14" fill="#EEF2FF" />
      <text x="24" y="73" fill="#4F46E5" fontSize="12">🧠</text>

      <rect x="50" y="56" width="200" height="40" rx="14" fill="#F1F5F9" className="tutor-msg-1" />
      <rect x="50" y="56" width="200" height="40" rx="14" stroke="#E2E8F0" strokeWidth="1" />
      <text x="62" y="72" fill="#334155" fontSize="9.5" fontFamily="sans-serif">¡Hola! Soy tu tutor. Voy a</text>
      <text x="62" y="86" fill="#334155" fontSize="9.5" fontFamily="sans-serif">guiarte paso a paso. ¿Listo? 🎯</text>

      <rect x="150" y="108" width="150" height="28" rx="12" fill="#4F46E5" className="tutor-msg-2" />
      <text x="162" y="126" fill="white" fontSize="9.5" fontFamily="sans-serif">Hola, ¿cómo resuelvo 2x+5=15?</text>

      <circle cx="30" cy="152" r="14" fill="#EEF2FF" />
      <text x="24" y="157" fill="#4F46E5" fontSize="12">🧠</text>

      <rect x="50" y="140" width="210" height="44" rx="14" fill="#F1F5F9" className="tutor-msg-3" />
      <rect x="50" y="140" width="210" height="44" rx="14" stroke="#E2E8F0" strokeWidth="1" />
      <text x="62" y="156" fill="#334155" fontSize="9.5" fontFamily="sans-serif">Buena pregunta. Primero, ¿qué</text>
      <text x="62" y="170" fill="#334155" fontSize="9.5" fontFamily="sans-serif">operación está sumando a "2x"? 💡</text>

      <circle cx="30" cy="200" r="14" fill="#EEF2FF" />
      <text x="24" y="205" fill="#4F46E5" fontSize="12">🧠</text>
      <rect x="50" y="192" width="60" height="24" rx="12" fill="#F1F5F9" />
      <rect x="50" y="192" width="60" height="24" rx="12" stroke="#E2E8F0" strokeWidth="1" />
      <circle cx="63" cy="204" r="3" fill="#94A3B8" className="tutor-dot" />
      <circle cx="73" cy="204" r="3" fill="#94A3B8" className="tutor-dot" />
      <circle cx="83" cy="204" r="3" fill="#94A3B8" className="tutor-dot" />

      <rect x="20" y="248" width="280" height="24" rx="10" fill="#F1F5F9" />
      <text x="30" y="264" fill="#94A3B8" fontSize="9.5" fontFamily="sans-serif">Escribe tu respuesta...</text>
      <rect x="272" y="250" width="24" height="20" rx="7" fill="#4F46E5" />
      <text x="278" y="263" fill="white" fontSize="8">➤</text>
    </svg>
  );
}
