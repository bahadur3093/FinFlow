const STEPS = ['Upload', 'Unlock', 'Parse', 'Review', 'Sync'];

export default function CCStepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0 px-5 py-4 bg-white border-b border-gray-100">
      {STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  done
                    ? 'bg-green-500 text-white'
                    : active
                    ? 'bg-brand text-white ring-4 ring-brand/20'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-[9px] font-semibold ${active ? 'text-brand' : done ? 'text-green-500' : 'text-gray-300'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 mx-1 rounded-full transition-all ${done ? 'bg-green-400' : 'bg-gray-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
