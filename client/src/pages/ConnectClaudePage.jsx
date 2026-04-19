import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';

const MCP_BASE_URL =
  import.meta.env.VITE_MCP_BASE_URL || 'https://finflow-mcp.onrender.com';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ClaudeIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="white" fillOpacity="0.15" />
      <path
        d="M8.5 15.5L12 8l3.5 7.5M9.5 13.5h5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.95" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

// ─── Step illustrations ───────────────────────────────────────────────────────

function StepIllustration({ step }) {
  const base = "w-full h-24 rounded-xl flex items-center justify-center bg-brand-50 overflow-hidden relative";
  if (step === 1) return (
    <div className={base}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2" strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
        <div className="w-24 h-7 rounded-lg bg-white border border-brand/30 flex items-center justify-center">
          <span className="text-[9px] font-semibold text-brand">Settings</span>
        </div>
      </div>
    </div>
  );
  if (step === 2) return (
    <div className={base}>
      <div className="flex flex-col gap-1.5 w-36">
        {['Connectors', 'Appearance', 'Privacy'].map((item, i) => (
          <div key={item} className={`h-6 rounded-lg flex items-center px-3 ${i === 0 ? 'bg-brand text-white' : 'bg-white border border-gray-200'}`}>
            <span className={`text-[9px] font-semibold ${i === 0 ? 'text-white' : 'text-gray-500'}`}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
  if (step === 3) return (
    <div className={base}>
      <div className="w-48 space-y-1.5">
        <div className="h-6 rounded-lg bg-white border border-brand/40 flex items-center px-2.5 gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
          <span className="text-[8px] font-mono text-gray-500 truncate">https://finflow-mcp.onrender…</span>
        </div>
        <button className="w-full h-6 rounded-lg bg-brand flex items-center justify-center">
          <span className="text-[9px] font-semibold text-white">Connect</span>
        </button>
      </div>
    </div>
  );
  // step 4
  return (
    <div className={base}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-800">FinGlow connected!</p>
          <p className="text-[8px] text-gray-500">Ask Claude about your finances</p>
        </div>
      </div>
    </div>
  );
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

function RegenerateModal({ onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-card-lg">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 text-center mb-1">Regenerate MCP URL?</h3>
        <p className="text-xs text-gray-500 text-center mb-5 leading-relaxed">
          Your current URL will stop working immediately. You'll need to update it in Claude's connector settings.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 active:scale-[0.98] transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-2xl bg-red-500 text-sm font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: 1,
    title: 'Open Claude Settings',
    description: 'Go to claude.ai, click your profile icon (top-right), then tap Settings.',
  },
  {
    step: 2,
    title: 'Go to Connectors',
    description: 'In the left sidebar find Connectors → click Add custom connector.',
  },
  {
    step: 3,
    title: 'Paste your MCP URL',
    description: 'Paste the URL you copied above and click Connect. That\'s it!',
  },
  {
    step: 4,
    title: 'Start chatting',
    description: 'Claude now has access to your FinGlow data. Try the example prompts below.',
  },
];

const EXAMPLE_PROMPTS = [
  'What did I spend the most on this month?',
  'Add an expense of ₹500 for groceries today',
  'Show my income vs expense trend',
  'What\'s my current balance?',
  'Which budget am I closest to exceeding?',
  'List my last 5 transactions',
  'How much did I spend on food this month?',
  'What are my active loans?',
];

export default function ConnectClaudePage() {
  const navigate = useNavigate();
  const [mcpData, setMcpData] = useState(null);   // { token, expiresAt }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const mcpUrl = mcpData
    ? `${MCP_BASE_URL}/sse?token=${mcpData.token}`
    : '';

  const expiryFormatted = mcpData
    ? new Date(mcpData.expiresAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '';

  // ── Fetch (or lazily create) the token on mount ──────────────────────────
  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/mcp-token');
      setMcpData(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load your MCP URL. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  // ── Copy URL ─────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input text
      const input = document.getElementById('mcp-url-input');
      if (input) { input.select(); document.execCommand('copy'); }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Regenerate URL ────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data } = await api.delete('/auth/mcp-token');
      setMcpData(data);
      setShowRegen(false);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to regenerate. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <>
      <div className="pb-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white opacity-5" />

          {/* Back button */}
          <button
            onClick={() => navigate('/tools')}
            className="absolute top-4 left-4 w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-white"
          >
            <ChevronLeft />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <ClaudeIcon size={20} />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Connect Claude AI</h1>
              <p className="text-white/70 text-xs">Let Claude access your FinGlow data</p>
            </div>
          </div>
        </div>

        <div className="px-5 mt-5 space-y-4">

          {/* ── Your MCP URL ──────────────────────────────────────────────── */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">Your MCP URL</p>
              {mcpData && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                  Active
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-11 rounded-2xl bg-gray-100 animate-pulse" />
                <div className="flex gap-2">
                  <div className="flex-1 h-11 rounded-2xl bg-gray-100 animate-pulse" />
                  <div className="flex-1 h-11 rounded-2xl bg-gray-100 animate-pulse" />
                </div>
              </div>
            ) : error ? (
              <div className="space-y-3">
                <div className="bg-red-50 rounded-2xl px-4 py-3">
                  <p className="text-xs text-red-600 font-medium">{error}</p>
                </div>
                <button onClick={fetchToken} className="btn-primary">
                  Try Again
                </button>
              </div>
            ) : (
              <>
                {/* URL display */}
                <div className="relative">
                  <input
                    id="mcp-url-input"
                    readOnly
                    value={mcpUrl}
                    className="w-full bg-gray-50 rounded-2xl px-4 py-3 pr-12 text-[11px] font-mono text-gray-700 border border-gray-100 focus:outline-none truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl bg-brand-50 flex items-center justify-center text-brand transition-colors"
                    title="Copy URL"
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>

                {/* Expiry */}
                <p className="text-[11px] text-gray-400 -mt-1">
                  Expires <span className="font-semibold text-gray-600">{expiryFormatted}</span>
                </p>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand text-white text-sm font-semibold active:scale-[0.98] transition-transform shadow-sm"
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? 'Copied!' : 'Copy URL'}
                  </button>
                  <button
                    onClick={() => setShowRegen(true)}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold active:scale-[0.98] transition-transform"
                    title="Regenerate URL"
                  >
                    <RefreshIcon />
                    Regenerate
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Security note ─────────────────────────────────────────────── */}
          <div className="flex items-start gap-3 bg-amber-50 rounded-2xl px-4 py-3">
            <div className="flex-shrink-0 mt-0.5 text-amber-500">
              <ShieldIcon />
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              <span className="font-bold">Keep this URL private.</span> It grants full access to your financial data. Never share it publicly or commit it to code.
            </p>
          </div>

          {/* ── How to connect ────────────────────────────────────────────── */}
          <div className="card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              How to connect
            </p>
            <div className="space-y-5">
              {STEPS.map(({ step, title, description }) => (
                <div key={step} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand flex items-center justify-center mt-0.5">
                    <span className="text-[10px] font-bold text-white">{step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-2">{description}</p>
                    <StepIllustration step={step} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── What can Claude do ────────────────────────────────────────── */}
          <div className="card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              What can Claude do?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Once connected, try asking Claude things like:
            </p>
            <div className="space-y-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleCopy()}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-brand-50 active:scale-[0.98] transition-transform group"
                >
                  <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-brand/10 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <span className="text-xs text-brand font-medium leading-snug">"{prompt}"</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Help note ─────────────────────────────────────────────────── */}
          <div className="bg-brand-50 rounded-2xl px-4 py-4 text-center">
            <p className="text-xs font-semibold text-brand">Need help?</p>
            <p className="text-xs text-brand/60 mt-0.5">
              If Claude can't see your data, make sure you copied the full URL including the token.
            </p>
          </div>

        </div>
      </div>

      {/* ── Regenerate confirmation modal ──────────────────────────────────── */}
      {showRegen && (
        <RegenerateModal
          onConfirm={handleRegenerate}
          onCancel={() => setShowRegen(false)}
          loading={regenerating}
        />
      )}
    </>
  );
}
