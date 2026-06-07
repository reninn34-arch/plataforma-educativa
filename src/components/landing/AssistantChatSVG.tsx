"use client";

export function AssistantChatSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <style>{`
        @keyframes slide-up-msg {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-chip {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-ai {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        @keyframes typing-dot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 0.9; }
        }
        .chat-msg-1 { animation: slide-up-msg 0.5s ease-out 0.2s both; }
        .chat-msg-2 { animation: slide-up-msg 0.5s ease-out 0.6s both; }
        .chat-msg-3 { animation: slide-up-msg 0.5s ease-out 1s both; }
        .chat-chip { animation: fade-in-chip 0.4s ease-out both; }
        .chat-chip:nth-child(1) { animation-delay: 1.4s; }
        .chat-chip:nth-child(2) { animation-delay: 1.5s; }
        .chat-chip:nth-child(3) { animation-delay: 1.6s; }
        .chat-chip:nth-child(4) { animation-delay: 1.7s; }
        .chat-dot-1 { animation: typing-dot 1.2s ease-in-out infinite; }
        .chat-dot-2 { animation: typing-dot 1.2s ease-in-out 0.15s infinite; }
        .chat-dot-3 { animation: typing-dot 1.2s ease-in-out 0.3s infinite; }
        .chat-ai-pulse { animation: pulse-ai 2s ease-in-out infinite; }
      `}</style>

      <rect x="0" y="0" width="320" height="280" rx="16" fill="white" />

      <rect x="0" y="0" width="320" height="48" rx="16" fill="#4F46E5" />
      <rect x="0" y="32" width="320" height="16" fill="#4F46E5" />

      <rect x="14" y="12" width="26" height="24" rx="8" fill="#6366F1" />
      <text x="21" y="29" fill="white" fontSize="13">🤖</text>
      <text x="48" y="30" fill="white" fontSize="13" fontWeight="800" fontFamily="sans-serif">Asistente IA</text>
      <text x="48" y="40" fill="#A5B4FC" fontSize="9" fontFamily="sans-serif">En línea</text>

      <rect x="276" y="14" width="28" height="20" rx="8" fill="#6366F1" />
      <text x="282" y="28" fill="white" fontSize="8">✕</text>

      <circle cx="200" cy="56" r="14" fill="#EEF2FF" className="chat-ai-pulse" />
      <text x="194" y="61" fill="#4F46E5" fontSize="12">🤖</text>
      <rect x="218" y="46" width="86" height="28" rx="10" fill="#EEF2FF" className="chat-msg-1" />
      <text x="226" y="59" fill="#334155" fontSize="9" fontFamily="sans-serif">¡Hola! Soy Atlas,</text>
      <text x="226" y="70" fill="#334155" fontSize="9" fontFamily="sans-serif">tu asistente de IA 📚</text>

      <rect x="52" y="82" width="100" height="24" rx="10" fill="#4F46E5" className="chat-msg-2" />
      <text x="60" y="97" fill="white" fontSize="9" fontFamily="sans-serif">¿Cómo empiezo a estudiar?</text>

      <circle cx="200" cy="118" r="14" fill="#EEF2FF" className="chat-ai-pulse" />
      <text x="194" y="123" fill="#4F46E5" fontSize="12">🤖</text>
      <rect x="218" y="110" width="90" height="32" rx="10" fill="#EEF2FF" className="chat-msg-3" />
      <text x="226" y="124" fill="#334155" fontSize="9" fontFamily="sans-serif">Puedes practicar con</text>
      <text x="226" y="136" fill="#334155" fontSize="9" fontFamily="sans-serif">ejercicios interactivos 🎯</text>

      <text x="20" y="165" fill="#64748B" fontSize="9" fontFamily="sans-serif">Acciones rápidas</text>

      <rect x="20" y="173" width="82" height="26" rx="8" fill="#F8FAFC" className="chat-chip" />
      <rect x="20" y="173" width="82" height="26" rx="8" stroke="#4F46E5" strokeWidth="1" strokeOpacity="0.3" />
      <text x="30" y="189" fill="#4F46E5" fontSize="9" fontWeight="700" fontFamily="sans-serif">📝 Crear tarea</text>

      <rect x="110" y="173" width="80" height="26" rx="8" fill="#F8FAFC" className="chat-chip" />
      <rect x="110" y="173" width="80" height="26" rx="8" stroke="#E2E8F0" strokeWidth="1" />
      <text x="120" y="189" fill="#334155" fontSize="9" fontWeight="600" fontFamily="sans-serif">📚 Mis cursos</text>

      <rect x="198" y="173" width="56" height="26" rx="8" fill="#F8FAFC" className="chat-chip" />
      <rect x="198" y="173" width="56" height="26" rx="8" stroke="#E2E8F0" strokeWidth="1" />
      <text x="207" y="189" fill="#334155" fontSize="9" fontWeight="600" fontFamily="sans-serif">⚠️ Riesgo</text>

      <rect x="262" y="173" width="48" height="26" rx="8" fill="#F8FAFC" className="chat-chip" />
      <rect x="262" y="173" width="48" height="26" rx="8" stroke="#E2E8F0" strokeWidth="1" />
      <text x="269" y="189" fill="#334155" fontSize="9" fontWeight="600" fontFamily="sans-serif">🧠 Tutor</text>

      <rect x="20" y="210" width="80" height="26" rx="8" fill="#F8FAFC" className="chat-chip" />
      <rect x="20" y="210" width="80" height="26" rx="8" stroke="#E2E8F0" strokeWidth="1" />
      <text x="28" y="226" fill="#334155" fontSize="9" fontWeight="600" fontFamily="sans-serif">💬 Mensaje a curso</text>

      <rect x="102" y="206" width="20" height="30" rx="8" fill="#F1F5F9" />
      <circle cx="200" cy="216" r="12" fill="#EEF2FF" className="chat-ai-pulse" style={{ animationDelay: "1.8s" }} />
      <text x="194" y="221" fill="#4F46E5" fontSize="10">🤖</text>
      <text x="215" y="214" fill="#334155" fontSize="9" fontFamily="sans-serif">¿En qué más puedo</text>
      <text x="215" y="225" fill="#334155" fontSize="9" fontFamily="sans-serif">ayudarte?</text>

      <rect x="20" y="250" width="280" height="22" rx="8" fill="#F1F5F9" />
      <text x="28" y="264" fill="#94A3B8" fontSize="9" fontFamily="sans-serif">Pregunta sobre tus cursos...</text>
      <rect x="274" y="252" width="22" height="18" rx="6" fill="#4F46E5" />
      <text x="279" y="264" fill="white" fontSize="8">➤</text>
    </svg>
  );
}
