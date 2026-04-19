import { getCategoryConfidence } from '../../utils/ccCategories.js';

export default function CCSyncButton({ transactions, onSync, syncing }) {
  const included = transactions.filter((tx) => tx.included && tx.type === 'debit' && !tx.is_reversal && tx.ai_category !== 'Rewards');
  const uncategorized = included.filter(
    (tx) => getCategoryConfidence(tx.merchant, tx.ai_category) === 'low'
  );
  const blocked = uncategorized.length > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-5 py-4 pb-safe">
      {blocked && (
        <p className="text-xs text-amber-600 font-medium text-center mb-2">
          Categorize {uncategorized.length} transaction{uncategorized.length > 1 ? 's' : ''} before syncing
        </p>
      )}
      <button
        onClick={onSync}
        disabled={blocked || syncing || included.length === 0}
        className="btn-primary disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {syncing ? (
          <>
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Syncing…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Sync {included.length} transaction{included.length !== 1 ? 's' : ''} to FinTracker
          </>
        )}
      </button>
    </div>
  );
}
