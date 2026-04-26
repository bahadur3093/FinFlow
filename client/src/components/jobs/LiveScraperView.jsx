import { useEffect, useRef } from 'react';

const PLATFORM_META = {
  LinkedIn:  { color: '#0A66C2', icon: '💼' },
  Naukri:    { color: '#FF7555', icon: '🔍' },
  Indeed:    { color: '#2557A7', icon: '📋' },
  Glassdoor: { color: '#0CAA41', icon: '🚪' },
};

export default function LiveScraperView({ screenshot, statusMessages, platformStatuses, jobCount, phase }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [statusMessages]);

  const isRunning = phase === 'scraping' || phase === 'scoring';

  return (
    <div className="space-y-4">
      {/* Phase banner */}
      <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
        phase === 'complete' ? 'bg-green-50' : phase === 'error' ? 'bg-red-50' : 'bg-brand-50'
      }`}>
        {isRunning && (
          <div className="w-5 h-5 flex-shrink-0">
            <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1A6BFF" strokeWidth="3" />
              <path className="opacity-75" fill="#1A6BFF" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        {phase === 'complete' && <span className="text-lg">✅</span>}
        {phase === 'error' && <span className="text-lg">❌</span>}
        <div>
          <p className={`text-sm font-bold ${
            phase === 'complete' ? 'text-green-700' : phase === 'error' ? 'text-red-700' : 'text-brand'
          }`}>
            {phase === 'scraping' && 'Scraping job portals...'}
            {phase === 'scoring'  && 'AI scoring jobs...'}
            {phase === 'complete' && `Done! Found ${jobCount} jobs`}
            {phase === 'error'    && 'Scraping encountered an error'}
            {phase === 'idle'     && 'Ready to scrape'}
          </p>
          {jobCount > 0 && phase !== 'complete' && (
            <p className="text-xs text-brand/70">{jobCount} jobs found so far</p>
          )}
        </div>
      </div>

      {/* Platform status pills */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(PLATFORM_META).map(([name, meta]) => {
          const ps = platformStatuses[name];
          return (
            <div
              key={name}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                ps?.status === 'starting' ? 'border-blue-300 bg-blue-50' :
                ps?.status === 'done'     ? 'border-green-300 bg-green-50' :
                ps?.status === 'error'    ? 'border-red-200 bg-red-50' :
                'border-gray-100 bg-gray-50'
              }`}
            >
              <span className="text-base">{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-700">{name}</p>
                <p className={`text-[10px] truncate ${
                  ps?.status === 'done'  ? 'text-green-600' :
                  ps?.status === 'error' ? 'text-red-500' :
                  ps?.status === 'starting' ? 'text-blue-600' :
                  'text-gray-400'
                }`}>
                  {ps?.status === 'done'     ? `✓ ${ps.count || 0} jobs` :
                   ps?.status === 'error'    ? (ps.timedOut ? '⏱ Timed out' : '✗ Error') :
                   ps?.status === 'starting' ? 'Scanning...' :
                   'Waiting'}
                </p>
              </div>
              {ps?.status === 'starting' && (
                <div className="w-3 h-3 flex-shrink-0">
                  <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle opacity=".25" cx="12" cy="12" r="10" stroke={meta.color} strokeWidth="3" />
                    <path opacity=".75" fill={meta.color} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live browser screenshot */}
      {screenshot && (
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 bg-gray-700 rounded-md px-3 py-1 text-[10px] text-gray-300 truncate">
                Live browser view
              </div>
              {isRunning && (
                <span className="flex items-center gap-1 text-[10px] text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
          <img
            src={`data:image/jpeg;base64,${screenshot}`}
            alt="Live browser view"
            className="w-full object-cover"
            style={{ maxHeight: '260px', objectPosition: 'top' }}
          />
        </div>
      )}

      {/* Status log */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Activity Log</p>
        <div
          ref={logRef}
          className="bg-gray-900 rounded-2xl p-3 h-32 overflow-y-auto space-y-1 font-mono"
        >
          {statusMessages.length === 0 ? (
            <p className="text-[11px] text-gray-600">Waiting to start...</p>
          ) : (
            statusMessages.map((msg, i) => (
              <p key={i} className="text-[11px] text-green-400 leading-relaxed">
                <span className="text-gray-600">[{msg.time}]</span> {msg.text}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
