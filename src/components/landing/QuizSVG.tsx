"use client";

export function QuizSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <style>{`
        @keyframes float-card {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes bounce-in {
          0% { opacity: 0; transform: scale(0.7) translateY(15px); }
          60% { transform: scale(1.05) translateY(-3px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slide-option {
          0% { opacity: 0; transform: translateX(-15px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes pop-check {
          0% { transform: scale(0) rotate(-45deg); }
          60% { transform: scale(1.3) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes shake-wrong {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px) rotate(-1deg); }
          40% { transform: translateX(6px) rotate(1deg); }
          60% { transform: translateX(-4px) rotate(-0.5deg); }
          80% { transform: translateX(4px) rotate(0.5deg); }
        }
        @keyframes spin-star {
          0% { transform: rotate(0deg) scale(0); opacity: 0; }
          50% { transform: rotate(180deg) scale(1.2); opacity: 1; }
          100% { transform: rotate(360deg) scale(1); opacity: 0.7; }
        }
        @keyframes pulse-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes float-q {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes glow-correct {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer-bar {
          0% { opacity: 0.15; }
          50% { opacity: 0.4; }
          100% { opacity: 0.15; }
        }
        .quiz-card { animation: float-card 3.5s ease-in-out infinite; }
        .quiz-bounce { animation: bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .quiz-opt-1 { animation: slide-option 0.4s ease-out 0.1s both; }
        .quiz-opt-2 { animation: slide-option 0.4s ease-out 0.25s both; }
        .quiz-opt-3 { animation: slide-option 0.4s ease-out 0.4s both; }
        .quiz-opt-4 { animation: slide-option 0.4s ease-out 0.55s both; }
        .quiz-check { animation: pop-check 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.9s both; transform-origin: 270px 127px; }
        .quiz-wrong { animation: shake-wrong 0.5s ease 0.7s both; }
        .quiz-star { animation: spin-star 2s ease-out 0.5s both; }
        .quiz-star-2 { animation: spin-star 2s ease-out 0.8s both; }
        .quiz-star-3 { animation: spin-star 2s ease-out 1.1s both; }
        .quiz-badge { animation: pulse-badge 2s ease-in-out 0.5s infinite; transform-origin: 140px 27px; }
        .quiz-q-icon { animation: float-q 2.5s ease-in-out infinite; }
        .quiz-glow { animation: glow-correct 1.5s ease-in-out 0.9s infinite; }
        .quiz-shimmer-1 { animation: shimmer-bar 1.8s ease-in-out 0s infinite; }
        .quiz-shimmer-2 { animation: shimmer-bar 1.8s ease-in-out 0.3s infinite; }
        .quiz-shimmer-3 { animation: shimmer-bar 1.8s ease-in-out 0.6s infinite; }
      `}</style>

      <rect x="20" y="10" width="280" height="220" rx="16" fill="white" className="drop-shadow-md" />

      <rect x="20" y="10" width="280" height="40" rx="16" fill="#4F46E5" />
      <rect x="20" y="34" width="280" height="16" rx="0" fill="#4F46E5" />
      <text x="40" y="34" fill="white" fontSize="10" fontWeight="600" fontFamily="sans-serif">Ejercicio interactivo</text>

      <rect x="128" y="20" width="24" height="14" rx="7" fill="#818CF8" className="quiz-badge" />
      <text x="133" y="30" fill="white" fontSize="8" fontWeight="700" fontFamily="sans-serif">1/5</text>

      <g className="quiz-card">
        <rect x="36" y="56" width="248" height="48" rx="10" fill="#F5F3FF" className="quiz-bounce" />
        <rect x="48" y="66" width="160" height="4" rx="2" fill="#C7D2FE" className="quiz-shimmer-1" />
        <rect x="48" y="74" width="220" height="4" rx="2" fill="#C7D2FE" className="quiz-shimmer-2" />
        <rect x="48" y="82" width="120" height="4" rx="2" fill="#C7D2FE" className="quiz-shimmer-3" />

        <circle cx="54" cy="68" r="6" fill="#DDD6FE" className="quiz-q-icon" />
        <text x="52" y="72" fill="#7C3AED" fontSize="8" fontWeight="700" fontFamily="sans-serif">?</text>
      </g>

      <rect x="36" y="114" width="248" height="26" rx="8" fill="#F0FDF4" className="quiz-opt-1" />
      <rect x="36" y="114" width="26" height="26" rx="8" fill="#4F46E5" />
      <text x="47" y="131" fill="white" fontSize="11" fontWeight="700" fontFamily="sans-serif">A</text>
      <rect x="70" y="122" width="120" height="4" rx="2" fill="#BBF7D0" />
      <rect x="70" y="130" width="80" height="4" rx="2" fill="#BBF7D0" />
      <circle cx="270" cy="127" r="7" fill="#4ADE80" className="quiz-check" />
      <path d="M267 127L269 129L273 125" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="quiz-check" />
      <circle cx="270" cy="127" r="11" fill="#4ADE80" opacity="0.15" className="quiz-glow" />

      <g className="quiz-wrong">
        <rect x="36" y="146" width="248" height="26" rx="8" fill="#FEF2F2" />
        <rect x="36" y="146" width="26" height="26" rx="8" fill="#E5E7EB" />
        <text x="47" y="163" fill="#9CA3AF" fontSize="11" fontWeight="700" fontFamily="sans-serif">B</text>
        <rect x="70" y="155" width="110" height="4" rx="2" fill="#FECACA" />
        <rect x="70" y="163" width="90" height="4" rx="2" fill="#FECACA" />
        <text x="254" y="162" fill="#EF4444" fontSize="9" fontFamily="sans-serif" fontWeight="600">✕</text>
      </g>

      <rect x="36" y="178" width="248" height="26" rx="8" fill="#FAFAFA" className="quiz-opt-3" />
      <rect x="36" y="178" width="26" height="26" rx="8" fill="#E5E7EB" />
      <text x="47" y="195" fill="#9CA3AF" fontSize="11" fontWeight="700" fontFamily="sans-serif">C</text>
      <rect x="70" y="187" width="130" height="4" rx="2" fill="#E5E7EB" />

      <rect x="36" y="210" width="248" height="26" rx="8" fill="#FAFAFA" className="quiz-opt-4" />
      <rect x="36" y="210" width="26" height="26" rx="8" fill="#E5E7EB" />
      <text x="47" y="227" fill="#9CA3AF" fontSize="11" fontWeight="700" fontFamily="sans-serif">D</text>
      <rect x="70" y="219" width="100" height="4" rx="2" fill="#E5E7EB" />

      <g className="quiz-star">
        <circle cx="280" cy="60" r="2" fill="#FCD34D" />
        <path d="M280 56V64M276 60H284" stroke="#FCD34D" strokeWidth="1" />
      </g>
      <g className="quiz-star-2">
        <circle cx="40" cy="100" r="2" fill="#FCD34D" />
        <path d="M40 96V104M36 100H44" stroke="#FCD34D" strokeWidth="1" />
      </g>
      <g className="quiz-star-3">
        <circle cx="290" cy="210" r="2" fill="#FCD34D" />
        <path d="M290 206V214M286 210H294" stroke="#FCD34D" strokeWidth="1" />
      </g>
    </svg>
  );
}
