import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import {
  classifyMerchant,
  FINTRACK_CATEGORY_MAP,
  checkDuplicate,
  recordImport,
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
import CCDoneScreen       from '../components/credit-card/CCDoneScreen.jsx';

// step index maps to CCStepIndicator positions 0-4
const STEP_IDX = { idle: 0, unlocking: 1, parsing: 2, reviewing: 3, syncing: 4, done: 4 };

// Assign stable _id and set default inclusion for each parsed transaction
function hydrate(transactions) {
  return transactions.map((tx, i) => ({
    ...tx,
    _id: `tx-${i}`,
    // Reversals and Rewards excluded by default; debits included
    included: tx.type === 'debit' && !tx.is_reversal && tx.ai_category !== 'Rewards',
    // Boost AI category with local rules when AI says Others
    ai_category:
      tx.ai_category === 'Others'
        ? classifyMerchant(tx.merchant) || 'Others'
        : tx.ai_category || classifyMerchant(tx.merchant) || 'Others',
  }));
}

export default function CreditCardPage() {
  const navigate = useNavigate();

  const [step, setStep]           = useState('idle');
  const [parseStage, setParseStage] = useState('unlocking');
  const [error, setError]         = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  const [parsed, setParsed]       = useState(null); // { summary, transactions, emis, charges }
  const [transactions, setTransactions] = useState([]); // hydrated, mutable

  const [syncResult, setSyncResult] = useState({ synced: 0, failed: 0 });
  const [reminderSet, setReminderSet] = useState(false);

  // ── Step 1→2→3: Upload → Unlock → Parse ────────────────────────────────

  const handleFileReady = useCallback(async (file, password) => {
    setError('');
    setUploadLoading(true);

    try {
      // ── Step 2: Unlock PDF ──────────────────────────────────────────────
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

      // ── Step 3a: Parse with Claude ─────────────────────────────────────
      setStep('parsing');
      setParseStage('parsing');

      const parseForm = new FormData();
      parseForm.append('statement', unlockedBlob, 'statement.pdf');

      const parseRes = await api.post('/ai/parse-credit-statement', parseForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min — Claude needs time for large PDFs
      });

      const data = parseRes.data;

      // ── Step 3b: Categorize ────────────────────────────────────────────
      setParseStage('categorizing');
      await new Promise((r) => setTimeout(r, 600)); // let UI show the stage

      // Duplicate detection
      const dupe = checkDuplicate(data.summary);
      if (dupe) {
        const importedDate = new Date(dupe.importedAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric',
        });
        if (!window.confirm(`This statement (${data.summary.bank} ${data.summary.statement_date}) was already imported on ${importedDate}.\n\nContinue anyway?`)) {
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
          // blob responses need text() extraction
          const text = err.response.data instanceof Blob
            ? await err.response.data.text()
            : JSON.stringify(err.response.data);
          const json = JSON.parse(text);
          msg = json.error || msg;
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

  // ── Review: edit a transaction field ───────────────────────────────────

  const handleEdit = useCallback((id, updates) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx._id === id ? { ...tx, ...updates } : tx))
    );
  }, []);

  const handleToggle = useCallback((id) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx._id === id ? { ...tx, included: !tx.included } : tx))
    );
  }, []);

  // ── Step 4: Sync to FinTracker ─────────────────────────────────────────

  const handleSync = useCallback(async () => {
    const toSync = transactions.filter(
      (tx) => tx.included && tx.type === 'debit' && !tx.is_reversal && tx.ai_category !== 'Rewards'
    );
    if (!toSync.length) return;

    setStep('syncing');
    let synced = 0;
    let failed = 0;

    // Batch in groups of 10
    const BATCH = 10;
    for (let i = 0; i < toSync.length; i += BATCH) {
      const batch = toSync.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((tx) =>
          api.post('/transactions', {
            description: tx.note ? `${tx.merchant} — ${tx.note}` : tx.merchant,
            amount: tx.amount,
            type: 'expense',
            category: FINTRACK_CATEGORY_MAP[tx.ai_category] || 'Other',
            date: tx.date,
            source: 'credit_card',
          })
        )
      );
      results.forEach((r) => {
        if (r.status === 'fulfilled') synced++;
        else failed++;
      });
    }

    // Record import hash so duplicate detection works next time
    if (parsed?.summary) recordImport(parsed.summary, synced);

    setSyncResult({ synced, failed });
    setStep('done');
  }, [transactions, parsed]);

  // ── Step 5: Google Calendar reminder ──────────────────────────────────

  const handleSetReminder = useCallback(async () => {
    if (!parsed?.summary?.due_date || reminderSet) return;
    try {
      const due = new Date(parsed.summary.due_date);
      // Remind 2 days before
      const remindDate = new Date(due);
      remindDate.setDate(remindDate.getDate() - 2);

      const isoStart = remindDate.toISOString().split('T')[0];
      const isoEnd = isoStart; // all-day

      await api.post('/shortcuts/calendar-reminder', {
        title: `💳 CC Payment Due — ₹${Math.round(parsed.summary.total_due).toLocaleString('en-IN')}`,
        date: isoStart,
        description: `${parsed.summary.bank || 'Credit Card'} ${parsed.summary.card_last4 ? `•••• ${parsed.summary.card_last4}` : ''}\nMinimum: ₹${Math.round(parsed.summary.minimum_due || 0).toLocaleString('en-IN')}\nFull amount: ₹${Math.round(parsed.summary.total_due).toLocaleString('en-IN')}\nActual due date: ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      });
      setReminderSet(true);
    } catch {
      // Calendar is optional; fail silently, just mark unset
    }
  }, [parsed, reminderSet]);

  // ── Render ─────────────────────────────────────────────────────────────

  const stepIdx = STEP_IDX[step] ?? 0;

  return (
    <div className="pb-32">
      {/* Header */}
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
            <p className="text-white/70 text-xs">Parse statement · Review · Sync to FinTracker</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <CCStepIndicator currentStep={stepIdx} />

      {/* ── Content ─────────────────────────────────────────────────── */}

      {/* Step: idle / upload */}
      {step === 'idle' && (
        <div className="px-5 mt-6">
          <div className="card">
            <CCUploadPanel
              onFileReady={handleFileReady}
              error={error}
              loading={uploadLoading}
            />
          </div>
        </div>
      )}

      {/* Step: unlocking / parsing */}
      {(step === 'unlocking' || step === 'parsing') && (
        <div className="px-5 mt-6">
          <div className="card">
            <CCParsingLoader stage={parseStage} />
          </div>
        </div>
      )}

      {/* Step: reviewing */}
      {step === 'reviewing' && parsed && (
        <div className="px-5 mt-6 space-y-4">
          {/* Duplicate / carry-over notice */}
          {parsed.summary?.opening_balance > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 rounded-2xl px-4 py-3">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-orange-600 font-medium">
                Opening balance of ₹{parsed.summary.opening_balance.toLocaleString('en-IN')} carried from previous bill — not included in sync
              </p>
            </div>
          )}

          <CCStatementSummary summary={parsed.summary} />
          <CCTransactionTable
            transactions={transactions}
            onEdit={handleEdit}
            onToggle={handleToggle}
          />
          <CCEmiSection emis={parsed.emis} />
          <CCChargesSection charges={parsed.charges} />
          <CCCategoryChart transactions={transactions} />
        </div>
      )}

      {/* Step: syncing (show reviewing UI with spinner overlay) */}
      {step === 'syncing' && (
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

      {/* Step: done */}
      {step === 'done' && (
        <div className="px-5 mt-6">
          <div className="card">
            <CCDoneScreen
              synced={syncResult.synced}
              failed={syncResult.failed}
              dueDate={parsed?.summary?.due_date}
              totalDue={parsed?.summary?.total_due}
              onSetReminder={handleSetReminder}
              reminderSet={reminderSet}
            />
          </div>
        </div>
      )}

      {/* Sticky sync button — only visible during review */}
      {step === 'reviewing' && (
        <CCSyncButton
          transactions={transactions}
          onSync={handleSync}
          syncing={step === 'syncing'}
        />
      )}
    </div>
  );
}
