const STAGES = [
  { key: 'unlocking',    label: 'Removing PDF password…' },
  { key: 'parsing',      label: 'Extracting transactions with AI…' },
  { key: 'categorizing', label: 'Auto-categorizing merchants…' },
];

export default function CCParsingLoader({ stage }) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex flex-col items-center py-12 px-5 gap-8">
      {/* Animated icon */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
        <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <p className="text-gray-900 font-bold text-base">Analysing Statement</p>
        <p className="text-xs text-gray-400 mt-1">This takes about 15–30 seconds</p>
      </div>

      {/* Checklist */}
      <div className="w-full bg-gray-50 rounded-2xl px-4 py-4 space-y-3">
        {STAGES.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-3">
              {done ? (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              ) : active ? (
                <div className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
              )}
              <span className={`text-xs font-medium ${done ? 'text-green-600' : active ? 'text-gray-800' : 'text-gray-300'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-300 text-center">
        Your PDF is processed securely and never stored
      </p>
    </div>
  );
}
