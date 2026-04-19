import { useState, useMemo } from 'react';
import { getCategoryConfidence, ALL_CC_CATEGORIES } from '../../utils/ccCategories.js';
import CCTransactionRow from './CCTransactionRow.jsx';

const TABS = [
  { id: 'expenses',  label: 'Expenses' },
  { id: 'refunds',   label: 'Refunds' },
  { id: 'rewards',   label: 'Rewards' },
];

function groupByDate(txns) {
  const groups = {};
  txns.forEach((tx) => {
    const key = tx.date
      ? new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
      : 'Unknown Date';
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });
  return groups;
}

export default function CCTransactionTable({ transactions, onEdit, onToggle }) {
  const [tab, setTab] = useState('expenses');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showCatPicker, setShowCatPicker] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (tab === 'expenses' && (tx.is_reversal || tx.ai_category === 'Rewards')) return false;
      if (tab === 'refunds' && !tx.is_reversal) return false;
      if (tab === 'rewards' && tx.ai_category !== 'Rewards') return false;
      if (catFilter !== 'All' && tx.ai_category !== catFilter) return false;
      if (search && !tx.merchant.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, tab, search, catFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const dateKeys = Object.keys(grouped);

  const counts = useMemo(() => ({
    expenses: transactions.filter((t) => !t.is_reversal && t.ai_category !== 'Rewards').length,
    refunds:  transactions.filter((t) => t.is_reversal).length,
    rewards:  transactions.filter((t) => t.ai_category === 'Rewards').length,
  }), [transactions]);

  const uncategorized = transactions.filter(
    (tx) => getCategoryConfidence(tx.merchant, tx.ai_category) === 'low' && tx.included
  ).length;

  return (
    <div className="card space-y-0 overflow-hidden p-0">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-400'
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              tab === t.id ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex gap-2 px-4 pt-3 pb-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search merchant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowCatPicker((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
              catFilter !== 'All' ? 'border-brand bg-brand-50 text-brand' : 'border-gray-100 bg-gray-50 text-gray-500'
            }`}
          >
            {catFilter === 'All' ? 'Category' : catFilter}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showCatPicker && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-2xl shadow-card-lg border border-gray-100 py-1 min-w-[160px]">
              {['All', ...ALL_CC_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCatFilter(cat); setShowCatPicker(false); }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold transition-colors ${
                    catFilter === cat ? 'text-brand bg-brand-50' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Uncategorized warning */}
      {uncategorized > 0 && tab === 'expenses' && (
        <div className="mx-4 mb-2 flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-xs font-semibold text-amber-600">
            {uncategorized} transaction{uncategorized > 1 ? 's' : ''} need{uncategorized === 1 ? 's' : ''} categorization before sync
          </p>
        </div>
      )}

      {/* Transaction rows grouped by date */}
      <div className="px-4 pb-4">
        {dateKeys.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400 font-medium">No transactions match</p>
          </div>
        ) : (
          dateKeys.map((date) => (
            <div key={date}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-4 pb-1">
                {date}
              </p>
              {grouped[date].map((tx) => (
                <CCTransactionRow
                  key={tx._id}
                  tx={tx}
                  onEdit={onEdit}
                  onToggle={onToggle}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
