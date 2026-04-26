import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useSocket } from '../context/SocketContext.jsx';

const PLATFORM_META = {
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', bg: 'bg-blue-50',   text: 'text-blue-700'   },
  naukri:    { label: 'Naukri',    color: '#FF7555', bg: 'bg-orange-50', text: 'text-orange-700' },
  indeed:    { label: 'Indeed',    color: '#2557A7', bg: 'bg-violet-50', text: 'text-violet-700' },
  glassdoor: { label: 'Glassdoor', color: '#0CAA41', bg: 'bg-green-50',  text: 'text-green-700'  },
};

const STATUS_OPTS = [
  { value: 'new',      label: 'New',     color: '#6B7280' },
  { value: 'saved',    label: 'Saved',   color: '#2563EB' },
  { value: 'applied',  label: 'Applied', color: '#16A34A' },
  { value: 'rejected', label: 'Pass',    color: '#DC2626' },
];

function ScoreRing({ score, size = 72 }) {
  if (score == null)
    return (
      <div
        className="rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 font-semibold"
        style={{ width: size, height: size }}
      >
        N/A
      </div>
    );
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const cx = size / 2;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <circle
          cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </svg>
      <span
        className="absolute inset-0 flex flex-col items-center justify-center font-bold leading-none"
        style={{ color }}
      >
        <span style={{ fontSize: size * 0.26 }}>{score}</span>
        <span style={{ fontSize: size * 0.13, color: '#9CA3AF', fontWeight: 500 }}>/ 100</span>
      </span>
    </div>
  );
}

// ── Screenshot section ─────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS  = 90_000;

function ScreenshotSection({ jobId, existingUrl, jobUrl, socket }) {
  const [screenshotUrl, setScreenshotUrl] = useState(existingUrl || null);
  const [status, setStatus] = useState(existingUrl ? 'done' : 'processing');
  const [capturedAt, setCapturedAt] = useState(null);
  const [recapturing, setRecapturing] = useState(false);

  const markDone = useCallback((url) => {
    setScreenshotUrl(url);
    setCapturedAt(new Date());
    setStatus('done');
  }, []);

  // Socket: catches the event if the user is on the page when capture finishes
  useEffect(() => {
    if (!socket) return;
    const handler = ({ jobId: id, screenshotUrl: url }) => {
      if (id === jobId) markDone(url);
    };
    socket.on('job:screenshot_ready', handler);
    return () => socket.off('job:screenshot_ready', handler);
  }, [socket, jobId, markDone]);

  // Poll: catches the case where the user opens the page after the event already fired
  useEffect(() => {
    if (existingUrl) return;           // already have it — no need to poll
    if (status === 'done') return;

    const started = Date.now();
    let timer;

    const poll = async () => {
      // Stop polling if component already got the URL via socket
      if (status === 'done') return;

      try {
        const { data } = await api.get(`/jobs/${jobId}`);
        if (data.screenshotUrl) { markDone(data.screenshotUrl); return; }
      } catch {}

      if (Date.now() - started >= POLL_TIMEOUT_MS) {
        // Background capture took too long — let user trigger manually
        setStatus('idle');
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [jobId, existingUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const recapture = async () => {
    setRecapturing(true);
    setStatus('processing');
    try {
      await api.post(`/jobs/${jobId}/screenshot`);
      // Result arrives via socket or next poll cycle
    } catch {
      setStatus(screenshotUrl ? 'done' : 'idle');
    }
    setRecapturing(false);
  };

  return (
    <div className="card overflow-hidden">
      {/* Section header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Playwright Screenshot</p>
            <p className="text-[10px] text-gray-400">Live browser capture as proof</p>
          </div>
        </div>
        {(status === 'done' || status === 'idle') && (
          <button
            onClick={recapture}
            disabled={recapturing}
            className="text-[11px] text-brand font-semibold flex items-center gap-1 hover:underline disabled:opacity-50"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            {recapturing ? 'Queued...' : 'Recapture'}
          </button>
        )}
      </div>

      {/* States */}
      {status === 'idle' && (
        <div className="p-6 text-center space-y-3">
          <button
            onClick={recapture}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: '#7C3AED' }}
          >
            Capture Screenshot
          </button>
        </div>
      )}

      {status === 'processing' && (
        <div className="p-8 flex flex-col items-center gap-4">
          {/* Fake browser chrome animation */}
          <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 bg-gray-700 rounded px-2 py-1 text-[10px] text-gray-400 truncate">
                {jobUrl}
              </div>
              <span className="flex items-center gap-1 text-[10px] text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            </div>
            {/* Skeleton content */}
            <div className="bg-white p-4 space-y-3">
              <div className="h-5 bg-gray-100 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
              <div className="h-24 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
            </div>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Capturing screenshot in the background...
          </p>
          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            Playwright is visiting this job URL headlessly,<br />screenshot will appear here once ready.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="p-6 text-center space-y-3">
          <p className="text-sm text-red-500 font-semibold">Screenshot failed</p>
          <p className="text-xs text-gray-400">The job page may require login or be unavailable.</p>
          <button onClick={capture} className="text-xs text-brand font-semibold hover:underline">
            Try again
          </button>
        </div>
      )}

      {status === 'done' && screenshotUrl && (
        <div>
          {/* Browser chrome */}
          <div className="bg-gray-800 px-3 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 bg-gray-700 rounded px-2 py-1 text-[10px] text-gray-300 truncate">
              {jobUrl}
            </div>
          </div>
          {/* Screenshot */}
          <img
            src={screenshotUrl}
            alt="Job posting screenshot"
            className="w-full object-cover object-top"
            style={{ maxHeight: '480px' }}
          />
          {/* Proof badge */}
          <div className="px-4 py-2.5 bg-violet-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span className="text-[11px] font-semibold text-violet-700">
                Captured via Playwright
              </span>
            </div>
            <span className="text-[10px] text-gray-400">
              {capturedAt
                ? capturedAt.toLocaleString()
                : 'Previously captured'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('new');
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    api.get(`/jobs/${id}`)
      .then(({ data }) => { setJob(data); setStatus(data.status); })
      .catch(() => navigate('/tools/jobs'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const updateStatus = async (val) => {
    setSavingStatus(true);
    try {
      await api.patch(`/jobs/${id}/status`, { status: val });
      setStatus(val);
    } catch {}
    setSavingStatus(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) return null;

  const pm = PLATFORM_META[job.platform] || PLATFORM_META.linkedin;
  // scoreDetails may arrive as a JSON string from some Prisma/API edge cases — parse safely
  const details = (() => {
    const raw = job.scoreDetails;
    if (!raw) return null;
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
    return typeof raw === 'object' && Object.keys(raw).length > 0 ? raw : null;
  })();
  const currentStatusMeta = STATUS_OPTS.find((s) => s.value === status) || STATUS_OPTS[0];

  return (
    <div className="pb-10">
      {/* Header */}
      <div
        className="relative px-5 pt-12 pb-6 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${pm.color}ee, ${pm.color}99)` }}
      >
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white opacity-5" />

        <button
          onClick={() => navigate('/tools/jobs', { state: { tab: 2 } })}
          className="flex items-center gap-1.5 text-xs font-semibold mb-5 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white px-3 py-1.5 rounded-full transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Results
        </button>

        <div className="flex items-start gap-4">
          <ScoreRing score={job.score} size={72} />
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pm.bg} ${pm.text}`}>
              {pm.label}
            </span>
            <h1 className="text-white text-lg font-bold leading-snug mt-1">{job.title}</h1>
            <p className="text-white/80 text-sm font-medium">{job.company}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 mt-4">
          {job.location && (
            <span className="flex items-center gap-1.5 text-[11px] text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {job.location}
            </span>
          )}
          {job.salary && (
            <span className="flex items-center gap-1.5 text-[11px] text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              {job.salary}
            </span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-1.5 text-[11px] text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {job.postedAt}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[11px] text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Scraped {new Date(job.scrapedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-5">
        {/* Action bar */}
        <div className="flex gap-3">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white text-center"
            style={{ background: pm.color }}
          >
            Apply on {pm.label}
          </a>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={savingStatus}
              className="appearance-none border-2 rounded-2xl px-3 py-3 pr-7 text-sm font-bold outline-none cursor-pointer"
              style={{ borderColor: currentStatusMeta.color, color: currentStatusMeta.color }}
            >
              {STATUS_OPTS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={currentStatusMeta.color} strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>

        {/* AI Score Breakdown */}
        {details && (
          <div className="card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <p className="text-sm font-bold text-gray-800">AI Match Analysis</p>
            </div>

            {details.summary && (
              <p className="text-xs text-gray-600 bg-brand-50 rounded-xl px-3 py-2.5 leading-relaxed">
                {details.summary}
              </p>
            )}

            <div className="space-y-3">
              {[
                { label: 'Skills Match',      val: details.skillsMatch,      max: 40, color: '#1A6BFF' },
                { label: 'Role Alignment',    val: details.roleMatch,        max: 30, color: '#7C3AED' },
                { label: 'Experience Fit',    val: details.experienceMatch,  max: 20, color: '#F59E0B' },
                { label: 'Location Match',    val: details.locationMatch,    max: 10, color: '#22C55E' },
              ].map(({ label, val, max, color }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">{label}</span>
                    <span className="text-xs font-bold text-gray-700">{val}/{max}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round((val / max) * 100)}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {(details.strengths?.length > 0 || details.gaps?.length > 0) && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {details.strengths?.length > 0 && (
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-green-700 mb-2 flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Strengths
                    </p>
                    <ul className="space-y-1">
                      {details.strengths.map((s, i) => (
                        <li key={i} className="text-[11px] text-green-700 leading-snug">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {details.gaps?.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-red-600 mb-2 flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Gaps
                    </p>
                    <ul className="space-y-1">
                      {details.gaps.map((g, i) => (
                        <li key={i} className="text-[11px] text-red-600 leading-snug">{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Screenshot proof */}
        <ScreenshotSection
          jobId={job.id}
          existingUrl={job.screenshotUrl}
          jobUrl={job.url}
          socket={socket}
        />

        {/* Job metadata */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Job Details</p>
          {[
            { label: 'Platform',  val: pm.label },
            { label: 'Company',   val: job.company },
            { label: 'Location',  val: job.location  || '—' },
            { label: 'Salary',    val: job.salary    || 'Not disclosed' },
            { label: 'Posted',    val: job.postedAt  || 'Unknown' },
            { label: 'Scraped',   val: new Date(job.scrapedAt).toLocaleString() },
          ].map(({ label, val }) => (
            <div key={label} className="flex justify-between items-start gap-4">
              <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
              <span className="text-xs font-semibold text-gray-700 text-right">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
