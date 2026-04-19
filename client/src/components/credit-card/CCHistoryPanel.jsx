import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js';
import { CATEGORY_STYLE, fmtCompact, fmt } from '../../utils/ccCategories.js';

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function groupByDate(txns) {
  const groups = {};
  txns.forEach((tx) => {
    const key = new Date(tx.date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long',
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });
  return groups;
}

function TxRow({ tx }) {
  const style = CATEGORY_STYLE[tx.category] || CATEGORY_STYLE['Others'];
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div
        className="w-1 h-9 rounded-full flex-shrink-0"
        style={{ backgroundColor: style.hex }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{tx.description}</p>
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${style.bg} ${style.text}`}>
          {tx.category}
        </span>
      </div>
      <p className="text-sm font-bold text-gray-800 flex-shrink-0 tabular-nums">
        {fmt(tx.amount)}
      </p>
    </div>
  );
}

export default function CCHistoryPanel({ onUploadNew }) {
  const [months, setMonths]           = useState([]);   // [{year,month,count,total}]
  const [selected, setSelected]       = useState(null); // {year,month}
  const [transactions, setTxns]       = useState([]);
  const [loadingMonths, setLM]        = useState(true);
  const [loadingTxns, setLT]          = useState(false);
  const [open, setOpen]               = useState(false); // dropdown open

  // ── Load available months on mount ─────────────────────────────────────
  useEffect(() => {
    api.get('/transactions/cc-months')
      .then(({ data }) => {
        setMonths(data);
        if (data.length > 0) setSelected({ year: data[0].year, month: data[0].month });
      })
      .catch(() => {})
      .finally(() => setLM(false));
  }, []);

  // ── Load transactions when selected month changes ───────────────────────
  useEffect(() => {
    if (!selected) return;
    setLT(true);
    api.get('/transactions', {
      params: { source: 'credit_card', month: selected.month, year: selected.year, limit: 200 },
    })
      .then(({ data }) => setTxns(data))
      .catch(() => setTxns([]))
      .finally(() => setLT(false));
  }, [selected]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const grouped   = groupByDate(transactions);
  const dateKeys  = Object.keys(grouped);
  const total     = transactions.reduce((s, t) => s + t.amount, 0);
  const selMonth  = selected
    ? months.find((m) => m.year === selected.year && m.month === selected.month)
    : null;

  // ── Empty state (no CC history at all) ─────────────────────────────────
  if (!loadingMonths && months.length === 0) {
    return (
      <div className="card flex flex-col items-center py-12 gap-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold text-gray-800">No statements synced yet</p>
          <p className="text-xs text-gray-400 mt-1">Upload your first CC statement to get started</p>
        </div>
        <button onClick={onUploadNew} className="btn-primary mt-2">
          Upload Statement
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month selector + Upload CTA */}
      <div className="flex items-center gap-3">
        {/* Dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-200 text-sm font-semibold text-gray-800 shadow-card"
          >
            {loadingMonths ? (
              <span className="text-gray-400 text-xs">Loading…</span>
            ) : selected ? (
              <span>{MONTH_NAMES[selected.month]} {selected.year}</span>
            ) : (
              <span className="text-gray-400">Select month</span>
            )}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1 z-30 w-full bg-white rounded-2xl shadow-card-lg border border-gray-100 py-1 max-h-56 overflow-y-auto">
              {months.map((m) => {
                const isActive = selected?.year === m.year && selected?.month === m.month;
                return (
                  <button
                    key={`${m.year}-${m.month}`}
                    onClick={() => { setSelected({ year: m.year, month: m.month }); setOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                      isActive ? 'bg-brand-50 text-brand font-bold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-semibold">{MONTH_NAMES[m.month]} {m.year}</span>
                    <span className="text-xs text-gray-400">{m.count} txns</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Upload new */}
        <button
          onClick={onUploadNew}
          className="flex items-center gap-1.5 px-4 py-3 bg-brand text-white text-xs font-semibold rounded-2xl shadow-card flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>
      </div>

      {/* Summary card for selected month */}
      {selMonth && !loadingTxns && (
        <div className="bg-gradient-to-br from-brand to-brand-light rounded-2xl px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium">
              {MONTH_NAMES[selMonth.month]} {selMonth.year} · {selMonth.count} transactions
            </p>
            <p className="text-white text-2xl font-bold mt-0.5">{fmtCompact(total)}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="card p-0 overflow-hidden">
        {loadingTxns ? (
          <div className="py-10 flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <p className="text-xs text-gray-400">Loading transactions…</p>
          </div>
        ) : dateKeys.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400 font-medium">No transactions for this month</p>
          </div>
        ) : (
          <div className="px-4 pb-4">
            {dateKeys.map((date) => (
              <div key={date}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-4 pb-1">
                  {date}
                </p>
                {grouped[date].map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
