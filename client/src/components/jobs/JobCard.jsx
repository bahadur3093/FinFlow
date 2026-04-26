import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

const PLATFORM_COLORS = {
  linkedin:  { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  naukri:    { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  indeed:    { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  glassdoor: { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
};

const STATUS_OPTS = [
  { value: 'new',     label: 'New',     color: 'text-gray-500'  },
  { value: 'saved',   label: 'Saved',   color: 'text-blue-600'  },
  { value: 'applied', label: 'Applied', color: 'text-green-600' },
  { value: 'rejected',label: 'Pass',    color: 'text-red-500'   },
];

function ScoreRing({ score }) {
  if (score == null) return <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">N/A</div>;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

export default function JobCard({ job, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(job.status || 'new');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const pc = PLATFORM_COLORS[job.platform] || PLATFORM_COLORS.linkedin;

  const handleStatus = async (val) => {
    setSaving(true);
    try {
      await api.patch(`/jobs/${job.id}/status`, { status: val });
      setStatus(val);
      if (onStatusChange) onStatusChange(job.id, val);
    } catch {}
    setSaving(false);
  };

  const details = (() => {
    const raw = job.scoreDetails;
    if (!raw) return null;
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
    return typeof raw === 'object' && Object.keys(raw).length > 0 ? raw : null;
  })();

  return (
    <div
      className="card p-4 space-y-3 cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => navigate(`/tools/jobs/${job.id}`)}
    >
      <div className="flex items-start gap-3">
        <ScoreRing score={job.score} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 leading-snug">
                {job.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{job.company}</p>
            </div>
            <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>
              {job.platform.charAt(0).toUpperCase() + job.platform.slice(1)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {job.location && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {job.location}
              </span>
            )}
            {job.salary && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                {job.salary}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score bar breakdown */}
      {details && (
        <div className="space-y-1.5">
          {[
            { label: 'Skills', val: details.skillsMatch, max: 40 },
            { label: 'Role',   val: details.roleMatch,   max: 30 },
            { label: 'Exp',    val: details.experienceMatch, max: 20 },
            { label: 'Location', val: details.locationMatch, max: 10 },
          ].map(({ label, val, max }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${Math.round((val / max) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 w-8 text-right">{val}/{max}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI summary */}
      {details?.summary && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
          {details.summary}
        </p>
      )}

      {/* Strengths/Gaps toggle */}
      {details && (details.strengths?.length > 0 || details.gaps?.length > 0) && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-brand font-semibold flex items-center gap-1"
          >
            {expanded ? 'Hide details' : 'Show strengths & gaps'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {expanded && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-semibold text-green-600 mb-1">Strengths</p>
                <ul className="space-y-0.5">
                  {details.strengths.map((s, i) => (
                    <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                      <span className="text-green-500 mt-0.5">+</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-red-500 mb-1">Gaps</p>
                <ul className="space-y-0.5">
                  {details.gaps.map((g, i) => (
                    <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                      <span className="text-red-400 mt-0.5">−</span>{g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions — stop propagation so these don't also navigate */}
      <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1 flex-1">
          {STATUS_OPTS.filter((o) => o.value !== status).map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleStatus(opt.value)}
              disabled={saving}
              className={`text-[10px] font-semibold px-2 py-1.5 rounded-lg border border-gray-200 ${opt.color} hover:bg-gray-50 transition-colors`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onDelete && onDelete(job.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
