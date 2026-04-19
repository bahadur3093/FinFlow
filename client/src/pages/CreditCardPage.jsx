import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import {
  classifyMerchant,
  FINTRACK_CATEGORY_MAP,
  CATEGORY_STYLE,
  checkDuplicate,
  recordImport,
  fmt,
  fmtCompact,
} from '../utils/ccCategories.js';

import CCStepIndicator    from '../components/credit-card/CCStepIndicator.jsx';
import CCUploadPanel      from '../components/credit-card/CCUploadPanel.jsx';
import CCParsingLoader    from '../components/credit-card/CCParsingLoader.jsx';
import CCStatementSummary from '../components/credit-card/CCStatementSummary.jsx';
import CCTransactionTable from '../components/credit-card/CCTransactionTable.jsx';
import CCEmiSection       from '../components/credit-card/CCEmiSection.jsx';
import CCChargesSection   from '../components/credit-card/CCChargesSection.jsx';
import CCCategoryChart    from '../components/credit-card/CCCategoryChart.jsx';
import CCSyncButton       from '../components/credit-card/CCSyncButton.jsx';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STEP_IDX = { idle: 0, unlocking: 1, parsing: 2, reviewing: 3, syncing: 4 };

function hydrate(transactions) {
  return transactions.map((tx, i) => ({
    ...tx,
    _id: `tx-${i}`,
    included: tx.type === 'debit' && !tx.is_reversal && tx.ai_category !== 'Rewards',
    ai_category:
      tx.ai_category === 'Others'
        ? classifyMerchant(tx.merchant) || 'Others'
        : tx.ai_category || classifyMerchant(tx.merchant) || 'Others',
  }));
}

// ── Inline transaction list ──────────────────────────────────────────────────

function groupByDate(txns) {
  const groups = {};
  txns.forEach((tx) => {
    const key = new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });
  return groups;
}

function TxRow({ tx }) {
  const style = CATEGORY_STYLE[tx.category] || CATEGORY_STYLE['Others'];
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-1 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: style.hex }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{tx.description}</p>
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${style.bg} ${style.text}`}>
          {tx.category}
        </span>
      </div>
      <p className="text-sm font-bold text-gray-800 tabular-nums flex-shrink-0">{fmt(tx.amount)}</p>
    </div>
  );
}

function CCTransactionList({ refreshKey }) {
  const [months, setMonths]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [txns, setTxns]         = useState([]);
  const [loadingM, setLoadingM] = useState(true);
  const [loadingT, setLoadingT] = useState(false);
  const [open, setOpen]         = useState(false);

  useEffect(() => {
    setLoadingM(true);
    api.get('/transactions/cc-months')
      .then(({ data }) => {
        setMonths(data);
        if (data.length) setSelected({ year: data[0].year, month: data[0].month });
      })
      .catch(() => {})
      .finally(() => setLoadingM(false));
  }, [refreshKey]); // re-fetch when a new sync completes

  useEffect(() => {
    if (!selected) return;
    setLoadingT(true);
    api.get('/transactions', {
      params: { source: 'credit_card', month: selected.month, year: selected.year, limit: 200 },
    })
      .then(({ data }) => setTxns(data))
      .catch(() => setTxns([]))
      .finally(() => setLoadingT(false));
  }, [selected]);

  const grouped  = groupByDate(txns);
  const dateKeys = Object.keys(grouped);
  const total    = txns.reduce((s, t) => s + t.amount, 0);
  const selMeta  = months.find((m) => m.year === selected?.year && m.month === selected?.month);

  if (!loadingM && months.length === 0) {
    return (
      <div className="card flex flex-col items-center py-10 gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round">
            <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-700">No CC transactions yet</p>
        <p className="text-xs text-gray-400">Parse and sync a statement above to see them here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Month picker + summary */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-200 text-sm font-semibold text-gray-800 shadow-card"
          >
            {loadingM ? (
              <span className="text-gray-400 text-xs">Loading…</span>
            ) : selected ? (
              <span>{MONTH_NAMES[selected.month]} {selected.year}</span>
            ) : (
              <span className="text-gray-400">Select month</span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1 z-30 w-full bg-white rounded-2xl shadow-card-lg border border-gray-100 py-1 max-h-52 overflow-y-auto">
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

        {selMeta && (
          <div className="bg-brand-50 rounded-2xl px-3 py-3 text-right flex-shrink-0">
            <p className="text-[10px] text-brand/60 font-medium">{selMeta.count} txns</p>
            <p className="text-sm font-bold text-brand">{fmtCompact(total)}</p>
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="card p-0 overflow-hidden">
        {loadingT ? (
          <div className="py-10 flex flex-col items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <p className="text-xs text-gray-400">Loading…</p>
          </div>
        ) : dateKeys.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">No transactions for this month</p>
          </div>
        ) : (
          <div className="px-4 pb-4">
            {dateKeys.map((date) => (
              <div key={date}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-4 pb-1">{date}</p>
                {grouped[date].map((tx) => <TxRow key={tx.id} tx={tx} />)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function CreditCardPage() {
  const navigate = useNavigate();

  // Parse accordion
  const [parseOpen,    setParseOpen]    = useState(false);
  const [step,         setStep]         = useState('idle');
  const [parseStage,   setParseStage]   = useState('unlocking');
  const [error,        setError]        = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [dupeWarning,  setDupeWarning]  = useState(null); // { bank, date, importedAt }
  const [pendingData,  setPendingData]  = useState(null); // parsed data waiting for dupe confirm

  // Review state
  const [parsed,       setParsed]       = useState(null);
  const [transactions, setTransactions] = useState([]);

  // Sync
  const [syncing,    setSyncing]    = useState(false);
  const [syncBanner, setSyncBanner] = useState(null); // { count, failed }
  const [syncKey,    setSyncKey]    = useState(0);    // increments → CCTransactionList refetches

  // Auto-dismiss sync banner
  useEffect(() => {
    if (!syncBanner) return;
    const t = setTimeout(() => setSyncBanner(null), 5000);
    return () => clearTimeout(t);
  }, [syncBanner]);

  // ── Upload → Unlock → Parse ─────────────────────────────────────────────

  const runParse = useCallback(async (file, password, skipDupeCheck = false) => {
    setError('');
    setDupeWarning(null);
    setUploadLoading(true);

    try {
      setStep('unlocking');
      setParseStage('unlocking');

      const unlockForm = new FormData();
      unlockForm.append('pdf', file);
      unlockForm.append('password', password);

      const unlockRes = await api.post('/tools/unlock-pdf', unlockForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
      });

      const unlockedBlob = new Blob([unlockRes.data], { type: 'application/pdf' });

      setStep('parsing');
      setParseStage('parsing');

      const parseForm = new FormData();
      parseForm.append('statement', unlockedBlob, 'statement.pdf');

      const parseRes = await api.post('/ai/parse-credit-statement', parseForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      const data = parseRes.data;

      setParseStage('categorizing');
      await new Promise((r) => setTimeout(r, 500));

      // Duplicate detection — inline, no window.confirm
      if (!skipDupeCheck) {
        const dupe = checkDuplicate(data.summary);
        if (dupe) {
          setPendingData({ file, password, parsed: data });
          setDupeWarning({
            bank: data.summary.bank,
            statementDate: data.summary.statement_date,
            importedAt: new Date(dupe.importedAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            }),
          });
          setStep('idle');
          setUploadLoading(false);
          return;
        }
      }

      setParsed(data);
      setTransactions(hydrate(data.transactions || []));
      setStep('reviewing');
    } catch (err) {
      let msg = 'Something went wrong. Please try again.';
      if (err.response?.data) {
        try {
          const text = err.response.data instanceof Blob
            ? await err.response.data.text()
            : JSON.stringify(err.response.data);
          msg = JSON.parse(text).error || msg;
        } catch { /* ignore */ }
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
      setStep('idle');
    } finally {
      setUploadLoading(false);
    }
  }, []);

  const handleFileReady = useCallback((file, password) => {
    runParse(file, password, false);
  }, [runParse]);

  const handleDupeConfirm = useCallback(() => {
    if (!pendingData) return;
    const { file, password } = pendingData;
    setDupeWarning(null);
    setPendingData(null);
    runParse(file, password, true);
  }, [pendingData, runParse]);

  const handleDupeCancel = useCallback(() => {
    setDupeWarning(null);
    setPendingData(null);
    setStep('idle');
  }, []);

  // ── Edit / toggle during review ──────────────────────────────────────────

  const handleEdit   = useCallback((id, updates) =>
    setTransactions((prev) => prev.map((tx) => tx._id === id ? { ...tx, ...updates } : tx)), []);

  const handleToggle = useCallback((id) =>
    setTransactions((prev) => prev.map((tx) => tx._id === id ? { ...tx, included: !tx.included } : tx)), []);

  // ── Sync ─────────────────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    const toSync = transactions.filter(
      (tx) => tx.included && tx.type === 'debit' && !tx.is_reversal && tx.ai_category !== 'Rewards'
    );
    if (!toSync.length) return;

    setSyncing(true);
    try {
      const payload = toSync.map((tx) => ({
        description: tx.note ? `${tx.merchant} — ${tx.note}` : tx.merchant,
        amount:      tx.amount,
        type:        'expense',
        category:    FINTRACK_CATEGORY_MAP[tx.ai_category] || 'Other',
        date:        tx.date,
        source:      'credit_card',
      }));

      const { data } = await api.post('/transactions/batch', { transactions: payload });
      if (parsed?.summary) recordImport(parsed.summary, data.count);

      // Collapse parse section, show banner, refresh list
      setParseOpen(false);
      setStep('idle');
      setParsed(null);
      setTransactions([]);
      setSyncBanner({ count: data.count, failed: 0 });
      setSyncKey((k) => k + 1);
    } catch (err) {
      console.error('[sync]', err.message);
      setSyncBanner({ count: 0, failed: toSync.length });
    } finally {
      setSyncing(false);
    }
  }, [transactions, parsed]);

  // ── Render ───────────────────────────────────────────────────────────────

  const inParseFlow = step !== 'idle';
  const stepIdx     = STEP_IDX[step] ?? 0;

  return (
    <div className="pb-24">
      {/* ── Header ── */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white opacity-5" />
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white/70 text-xs mb-3 hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">Credit Card</h1>
            <p className="text-white/70 text-xs">Parse statements · Review · Sync</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-4">

        {/* ── Sync success / error banner ── */}
        {syncBanner && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
            syncBanner.failed > 0 ? 'bg-red-50' : 'bg-green-50'
          }`}>
            {syncBanner.failed > 0 ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            <p className={`text-sm font-semibold flex-1 ${syncBanner.failed > 0 ? 'text-red-600' : 'text-green-700'}`}>
              {syncBanner.failed > 0
                ? `Sync failed for ${syncBanner.failed} transactions. Please try again.`
                : `${syncBanner.count} transactions synced successfully`}
            </p>
            <button onClick={() => setSyncBanner(null)} className="text-gray-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Duplicate warning banner ── */}
        {dupeWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 space-y-3">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-sm font-bold text-amber-800">Statement already imported</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {dupeWarning.bank} · {dupeWarning.statementDate} was synced on {dupeWarning.importedAt}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDupeCancel}
                className="flex-1 py-2 rounded-xl border border-amber-300 text-xs font-semibold text-amber-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDupeConfirm}
                className="flex-1 py-2 rounded-xl bg-amber-500 text-xs font-semibold text-white"
              >
                Import Anyway
              </button>
            </div>
          </div>
        )}

        {/* ── Parse accordion ── */}
        <div className="card overflow-hidden p-0">
          {/* Accordion header — always visible */}
          <button
            onClick={() => {
              if (inParseFlow) return; // don't collapse mid-parse
              setParseOpen((v) => !v);
              setError('');
              setDupeWarning(null);
            }}
            className="w-full flex items-center justify-between px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-800">Parse New Statement</p>
                <p className="text-xs text-gray-400">Upload a CC statement PDF to extract transactions</p>
              </div>
            </div>
            {!inParseFlow && (
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"
                className={`transition-transform flex-shrink-0 ${parseOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            )}
          </button>

          {/* Step indicator — only during parse flow */}
          {inParseFlow && <CCStepIndicator currentStep={stepIdx} />}

          {/* Accordion body */}
          {(parseOpen || inParseFlow) && (
            <div className="px-5 pb-5">
              {/* idle — show upload form */}
              {step === 'idle' && (
                <CCUploadPanel
                  onFileReady={handleFileReady}
                  error={error}
                  loading={uploadLoading}
                />
              )}

              {/* unlocking / parsing */}
              {(step === 'unlocking' || step === 'parsing') && (
                <CCParsingLoader stage={parseStage} />
              )}
            </div>
          )}
        </div>

        {/* ── Review UI (outside accordion so it gets full width) ── */}
        {step === 'reviewing' && parsed && (
          <div className="space-y-4">
            {parsed.summary?.opening_balance > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 rounded-2xl px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-xs text-orange-600 font-medium">
                  ₹{parsed.summary.opening_balance.toLocaleString('en-IN')} carried from previous bill — not synced
                </p>
              </div>
            )}
            <CCStatementSummary summary={parsed.summary} />
            <CCTransactionTable transactions={transactions} onEdit={handleEdit} onToggle={handleToggle} />
            <CCEmiSection emis={parsed.emis} />
            <CCChargesSection charges={parsed.charges} />
            <CCCategoryChart transactions={transactions} />
          </div>
        )}

        {/* ── Syncing overlay ── */}
        {syncing && (
          <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
              <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <p className="text-gray-900 font-bold">Syncing to FinTracker…</p>
            <p className="text-xs text-gray-400">Please don't close this page</p>
          </div>
        )}

        {/* ── CC Transactions section (always visible) ── */}
        {!inParseFlow && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CC Transactions</p>
            <CCTransactionList refreshKey={syncKey} />
          </div>
        )}

      </div>

      {/* Sticky sync button */}
      {step === 'reviewing' && (
        <CCSyncButton transactions={transactions} onSync={handleSync} syncing={syncing} />
      )}
    </div>
  );
}
