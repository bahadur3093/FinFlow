import { fmt, fmtCompact } from '../../utils/ccCategories.js';

function DueDateChip({ dueDate }) {
  if (!dueDate) return null;
  const days = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (days < 0) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">Overdue</span>;
  if (days <= 5) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">{days}d left</span>;
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">{days}d left</span>;
}

export default function CCStatementSummary({ summary }) {
  if (!summary) return null;

  const utilPct = summary.credit_limit
    ? Math.round(((summary.credit_limit - summary.available_credit) / summary.credit_limit) * 100)
    : 0;

  return (
    <div className="card space-y-4">
      {/* Bank + card */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {summary.bank || 'Credit Card'}
          </p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">
            {summary.card_type || 'Card'} •••• {summary.card_last4}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Statement</p>
          <p className="text-xs font-semibold text-gray-600">
            {summary.statement_date
              ? new Date(summary.statement_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </p>
        </div>
      </div>

      {/* Total due — hero */}
      <div className="bg-gradient-to-br from-brand to-brand-light rounded-2xl px-4 py-4">
        <p className="text-white/70 text-xs font-medium">Total Amount Due</p>
        <p className="text-white text-3xl font-bold mt-1">{fmtCompact(summary.total_due)}</p>
        <div className="flex items-center gap-2 mt-2">
          <p className="text-white/70 text-xs">Min: {fmtCompact(summary.minimum_due)}</p>
          <span className="text-white/30">·</span>
          <p className="text-white/70 text-xs">Due:</p>
          <p className="text-white text-xs font-semibold">
            {summary.due_date
              ? new Date(summary.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : '—'}
          </p>
          <DueDateChip dueDate={summary.due_date} />
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-2xl px-3 py-3">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Credit Limit</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">{fmtCompact(summary.credit_limit)}</p>
        </div>
        <div className="bg-gray-50 rounded-2xl px-3 py-3">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Available</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">{fmtCompact(summary.available_credit)}</p>
        </div>
        {summary.opening_balance > 0 && (
          <div className="bg-orange-50 rounded-2xl px-3 py-3">
            <p className="text-[10px] text-orange-400 font-medium uppercase tracking-wide">Carried Over</p>
            <p className="text-sm font-bold text-orange-600 mt-0.5">{fmtCompact(summary.opening_balance)}</p>
          </div>
        )}
        {summary.reward_points > 0 && (
          <div className="bg-amber-50 rounded-2xl px-3 py-3">
            <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">Reward Points</p>
            <p className="text-sm font-bold text-amber-600 mt-0.5">{summary.reward_points.toLocaleString('en-IN')}</p>
          </div>
        )}
      </div>

      {/* Credit utilisation bar */}
      {summary.credit_limit > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-400 font-medium">Credit Utilisation</p>
            <p className={`text-xs font-bold ${utilPct > 80 ? 'text-red-500' : utilPct > 50 ? 'text-orange-500' : 'text-green-600'}`}>
              {utilPct}%
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${utilPct > 80 ? 'bg-red-400' : utilPct > 50 ? 'bg-orange-400' : 'bg-green-400'}`}
              style={{ width: `${Math.min(utilPct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
