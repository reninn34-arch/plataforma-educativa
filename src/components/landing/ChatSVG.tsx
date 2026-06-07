"use client";

export function ChatSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <style>{`
        @keyframes slide-bounce {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          60% { transform: translateY(-4px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slide-bounce-right {
          0% { opacity: 0; transform: translateX(20px) scale(0.95); }
          60% { transform: translateX(-3px) scale(1.01); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes float-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes bounce-dot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes avatar-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
        .chat-msg-1 { animation: slide-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both; transform-origin: left center; }
        .chat-msg-2 { animation: slide-bounce-right 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s both; transform-origin: right center; }
        .chat-msg-3 { animation: slide-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1.1s both; transform-origin: left center; }
        .chat-avatar-1 { animation: avatar-bob 2.5s ease-in-out 0.1s infinite; }
        .chat-avatar-2 { animation: avatar-bob 2.5s ease-in-out 1.1s infinite; }
        .chat-dot-1 { animation: bounce-dot 0.6s ease-in-out 0s infinite; }
        .chat-dot-2 { animation: bounce-dot 0.6s ease-in-out 0.15s infinite; }
        .chat-dot-3 { animation: bounce-dot 0.6s ease-in-out 0.3s infinite; }
        .chat-ai-glow { animation: glow-pulse 2s ease-in-out 0.6s infinite; }
        .chat-header-icon { animation: wiggle 3s ease-in-out 1s infinite; transform-origin: 44px 30px; }
      `}</style>

      <rect x="20" y="10" width="280" height="220" rx="16" fill="white" className="drop-shadow-md" />
      <rect x="20" y="10" width="280" height="40" rx="16" fill="#4F46E5" />
      <rect x="20" y="34" width="280" height="16" rx="0" fill="#4F46E5" />

      <g className="chat-header-icon">
        <circle cx="44" cy="30" r="10" fill="#818CF8" />
        <path d="M38 34C38 31 41 29 44 29C47 29 50 31 50 34" fill="white" opacity="0.6" />
        <circle cx="44" cy="26" r="3" fill="white" opacity="0.6" />
      </g>

      <text x="62" y="34" fill="white" fontSize="10" fontWeight="600" fontFamily="sans-serif">Asistente IA</text>

      <rect x="232" y="17" width="50" height="18" rx="9" fill="#6366F1" />
      <circle cx="240" cy="26" r="3" fill="#A5B4FC" className="chat-dot-1" />
      <circle cx="248" cy="26" r="3" fill="#A5B4FC" className="chat-dot-2" />
      <circle cx="256" cy="26" r="3" fill="#A5B4FC" className="chat-dot-3" />

      <g className="chat-msg-1">
        <rect x="40" y="62" width="180" height="36" rx="12" fill="#EEF2FF" />
        <rect x="52" y="72" width="120" height="4" rx="2" fill="#C7D2FE" />
        <rect x="52" y="80" width="90" height="4" rx="2" fill="#C7D2FE" />
        <circle cx="36" cy="70" r="10" fill="#E0E7FF" className="chat-avatar-1" />
        <circle cx="36" cy="66" r="2" fill="#818CF8" />
        <path d="M31 73C31 71 33 70 36 70C39 70 41 71 41 73" fill="#A5B4FC" opacity="0.5" />
      </g>

      <g className="chat-msg-2">
        <rect x="100" y="108" width="180" height="44" rx="12" fill="#4F46E5" className="chat-ai-glow" />
        <rect x="112" y="118" width="130" height="4" rx="2" fill="#A5B4FC" opacity="0.7" />
        <rect x="112" y="126" width="100" height="4" rx="2" fill="#A5B4FC" opacity="0.7" />
        <rect x="112" y="134" width="70" height="4" rx="2" fill="#A5B4FC" opacity="0.7" />
      </g>

      <g className="chat-msg-3">
        <rect x="40" y="164" width="160" height="36" rx="12" fill="#EEF2FF" />
        <rect x="52" y="174" width="100" height="4" rx="2" fill="#C7D2FE" />
        <rect x="52" y="182" width="80" height="4" rx="2" fill="#C7D2FE" />
        <circle cx="36" cy="172" r="10" fill="#E0E7FF" className="chat-avatar-2" />
        <circle cx="36" cy="168" r="2" fill="#818CF8" />
        <path d="M31 175C31 173 33 172 36 172C39 172 41 173 41 175" fill="#A5B4FC" opacity="0.5" />

        <rect x="212" y="200" width="56" height="20" rx="10" fill="#EEF2FF" />
        <circle cx="222" cy="210" r="3" fill="#A5B4FC" className="chat-dot-1" />
        <circle cx="232" cy="210" r="3" fill="#A5B4FC" className="chat-dot-2" />
        <circle cx="242" cy="210" r="3" fill="#A5B4FC" className="chat-dot-3" />
      </g>
    </svg>
  );
}
