import { useState, useEffect } from 'react';
import api from '../services/api.js';

const TIP_COLORS = [
  { bg: 'bg-brand-50',  border: 'border-brand-100',  icon: 'bg-brand',     text: 'text-brand'      },
  { bg: 'bg-purple-50', border: 'border-purple-100',  icon: 'bg-purple-500', text: 'text-purple-600' },
  { bg: 'bg-green-50',  border: 'border-green-100',   icon: 'bg-green-500',  text: 'text-green-600'  },
];

const ICONS = [
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
  </svg>,
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>,
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 8v4l3 3"/>
  </svg>,
];

function InsightCard({ insight, index, visible }) {
  const color = TIP_COLORS[index % TIP_COLORS.length];
  return (
    <div className={`card border ${color.border} ${color.bg} transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${index * 120}ms` }}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-2xl ${color.icon} flex items-center justify-center flex-shrink-0`}>
          {ICONS[index % ICONS.length]}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${color.text} mb-1`}>{insight.title}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{insight.insight}</p>
        </div>
      </div>
      {insight.tip && (
        <div className="mt-3 pt-3 border-t border-white/60">
          <div className="flex items-start gap-2">
            <span className="text-xs">💡</span>
            <p className="text-xs text-gray-500 leading-relaxed">{insight.tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SpendingSummary({ transactions }) {
  const fmt = (n) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(n);

  const byCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  const COLORS = ['#1A6BFF', '#A78BFA', '#34D399', '#FB923C', '#F87171'];

  if (sorted.length === 0) return null;

  return (
    <div className="card">
      <p className="text-sm font-bold text-gray-900 mb-4">Top spending categories</p>
      <div className="space-y-3">
        {sorted.map(([cat, amount], i) => {
          const pct = total > 0 ? (amount / total) * 100 : 0;
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-sm text-gray-700">{cat}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{Math.round(pct)}%</span>
                  <span className="text-sm font-semibold text-gray-800">{fmt(amount)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: COLORS[i] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyTrend({ transactions }) {
  const fmt = (n) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(n);

  const byMonth = transactions.reduce((acc, t) => {
    const key = new Date(t.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!acc[key]) acc[key] = { income: 0, expense: 0 };
    acc[key][t.type] += t.amount;
    return acc;
  }, {});

  const months = Object.entries(byMonth).slice(-4);
  if (months.length === 0) return null;

  const maxVal = Math.max(...months.flatMap(([, v]) => [v.income, v.expense]));

  return (
    <div className="card">
      <p className="text-sm font-bold text-gray-900 mb-4">Monthly trend</p>
      <div className="flex items-end justify-around gap-2 h-28">
        {months.map(([month, vals]) => {
          const incomePct  = maxVal > 0 ? (vals.income  / maxVal) * 100 : 0;
          const expensePct = maxVal > 0 ? (vals.expense / maxVal) * 100 : 0;
          return (
            <div key={month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-1 h-20">
                <div className="w-4 rounded-t-lg bg-brand transition-all duration-700"
                  style={{ height: `${incomePct}%` }} />
                <div className="w-4 rounded-t-lg bg-red-400 transition-all duration-700"
                  style={{ height: `${expensePct}%` }} />
              </div>
              <span className="text-[10px] text-gray-400 font-medium">{month}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-brand" />
          <span className="text-xs text-gray-400">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="text-xs text-gray-400">Expenses</span>
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [insights, setInsights] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [insightsRes, txRes] = await Promise.all([
        api.get('/ai/insights'),
        api.get('/transactions?limit=100'),
      ]);
      setInsights(insightsRes.data);
      setTransactions(txRes.data);
      setTimeout(() => setVisible(true), 100);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load insights');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const fmt = (n) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(n);

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savingsRate  = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="flex items-start justify-between z-1 relative">
          <div>
            <h1 className="text-white text-xl font-bold mb-1">AI Insights</h1>
            <p className="text-white/70 text-xs">Powered by Gemini · based on your transactions</p>
          </div>
          <button onClick={() => { setVisible(false); fetchAll(true); }}
            disabled={refreshing}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"
              className={refreshing ? 'animate-spin' : ''}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-4">
        {/* Savings rate card */}
        {!loading && transactions.length > 0 && (
          <div className="card shadow-card-lg">
            <div className="flex items-center justify-between mt-6 mb-4">
              <p className="text-sm font-bold text-gray-900">Financial health</p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                savingsRate >= 20 ? 'bg-green-50 text-green-600' :
                savingsRate >= 0  ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
              }`}>
                {savingsRate >= 20 ? 'Great' : savingsRate >= 0 ? 'Fair' : 'Needs attention'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{fmt(totalIncome)}</p>
                <p className="text-xs text-gray-400">Income</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-500">{fmt(totalExpense)}</p>
                <p className="text-xs text-gray-400">Expenses</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-bold ${savingsRate >= 0 ? 'text-brand' : 'text-red-500'}`}>
                  {savingsRate}%
                </p>
                <p className="text-xs text-gray-400">Saved</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${
                savingsRate >= 20 ? 'bg-green-400' : savingsRate >= 0 ? 'bg-amber-400' : 'bg-red-400'
              }`} style={{ width: `${Math.max(Math.min(savingsRate, 100), 0)}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {savingsRate >= 20
                ? 'You\'re saving well — keep it up!'
                : savingsRate >= 0
                ? 'Try to save at least 20% of your income'
                : 'You\'re spending more than you earn this period'}
            </p>
          </div>
        )}

        {/* Monthly trend chart */}
        <MonthlyTrend transactions={transactions} />

        {/* Spending breakdown */}
        <SpendingSummary transactions={transactions} />

        {/* AI insight cards */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            AI recommendations
          </p>

          {error && (
            <div className="card bg-red-50 border border-red-100">
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={() => fetchAll()} className="text-xs text-red-400 font-semibold mt-2">
                Try again
              </button>
            </div>
          )}

          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="card animate-pulse mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-2xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded-full w-1/3" />
                    <div className="h-3 bg-gray-100 rounded-full w-full" />
                    <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                  </div>
                </div>
              </div>
            ))
          ) : insights.length === 0 && !error ? (
            <div className="card text-center py-8">
              <div className="w-14 h-14 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <p className="text-gray-700 font-semibold mb-1">No insights yet</p>
              <p className="text-xs text-gray-400">Add some transactions first so AI can analyse your spending patterns</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} index={i} visible={visible} />
              ))}
            </div>
          )}
        </div>

        {/* Refresh note */}
        {!loading && insights.length > 0 && (
          <p className="text-center text-xs text-gray-400">
            Tap the refresh button to get fresh AI insights
          </p>
        )}
      </div>
    </div>
  );
}