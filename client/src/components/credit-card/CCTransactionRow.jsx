import { useState } from 'react';
import { CATEGORY_STYLE, getCategoryConfidence, fmt } from '../../utils/ccCategories.js';
import CCEditModal from './CCEditModal.jsx';

function CategoryChip({ category, confidence }) {
  const style = CATEGORY_STYLE[category] || CATEGORY_STYLE['Others'];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
      {confidence === 'low' && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      )}
      {category || '? Uncategorized'}
    </span>
  );
}

export default function CCTransactionRow({ tx, onEdit, onToggle }) {
  const [showModal, setShowModal] = useState(false);

  const confidence = getCategoryConfidence(tx.merchant, tx.ai_category);
  const isExcluded = !tx.included;
  const isCredit = tx.type === 'credit';

  const handleSave = (updated) => {
    onEdit(tx._id, updated);
    setShowModal(false);
  };

  return (
    <>
      <div className={`flex items-center gap-3 py-3.5 border-b border-gray-50 last:border-0 transition-opacity ${isExcluded ? 'opacity-40' : ''}`}>
        {/* Include toggle */}
        <button
          onClick={() => onToggle(tx._id)}
          className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
            tx.included ? 'bg-brand border-brand' : 'border-gray-300'
          }`}
        >
          {tx.included && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </button>

        {/* Category colour bar */}
        <div
          className="w-1 h-9 rounded-full flex-shrink-0"
          style={{ backgroundColor: (CATEGORY_STYLE[tx.ai_category] || CATEGORY_STYLE['Others']).hex }}
        />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 truncate">{tx.merchant}</p>
            {tx.is_emi && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500">EMI</span>
            )}
            {tx.is_reversal && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-500">↩ Refund</span>
            )}
            {tx.foreign_currency && tx.foreign_currency !== 'INR' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-500">
                {tx.foreign_currency} {tx.foreign_amount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-400">
              {tx.date
                ? new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : '—'}
            </p>
            <CategoryChip category={tx.ai_category} confidence={confidence} />
          </div>
        </div>

        {/* Amount + edit */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className={`text-sm font-bold tabular-nums ${isCredit ? 'text-green-600' : 'text-gray-800'}`}>
            {isCredit ? '+' : ''}{fmt(tx.amount)}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-brand-50 hover:text-brand transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </div>

      {showModal && (
        <CCEditModal tx={tx} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
