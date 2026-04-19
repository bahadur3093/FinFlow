import { useState, useEffect } from 'react';
import { ALL_CC_CATEGORIES, fmt } from '../../utils/ccCategories.js';

export default function CCEditModal({ tx, onSave, onClose }) {
  const [form, setForm] = useState({
    merchant: tx.merchant || '',
    amount: tx.amount ?? '',
    date: tx.date || '',
    ai_category: tx.ai_category || 'Others',
    note: tx.note || '',
  });

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = () => {
    const amount = parseFloat(form.amount);
    if (!form.merchant.trim() || isNaN(amount) || amount <= 0 || !form.date) return;
    onSave({ ...form, amount });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl shadow-card-lg px-5 pt-4 pb-8 space-y-5 animate-slide-up">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />

        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-800">Edit Transaction</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Original amount (read-only badge) */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-4 py-2">
          <span className="text-xs text-gray-400">Original:</span>
          <span className={`text-sm font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-800'}`}>
            {tx.type === 'credit' ? '+' : ''}{fmt(tx.amount)}
          </span>
          {tx.is_emi && <span className="text-[10px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full font-semibold">EMI</span>}
          {tx.is_reversal && <span className="text-[10px] bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full font-semibold">Reversal</span>}
        </div>

        {/* Merchant */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Merchant</label>
          <input
            type="text"
            value={form.merchant}
            onChange={(e) => set('merchant', e.target.value)}
            className="input-field"
          />
        </div>

        {/* Amount + Date row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount (₹)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              className="input-field"
              min="0"
              step="0.01"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* Category picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CC_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => set('ai_category', cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  form.ai_category === cat
                    ? 'border-brand bg-brand text-white'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note (optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Add a personal note…"
            className="input-field"
          />
        </div>

        <button onClick={handleSave} className="btn-primary">Save Changes</button>
      </div>
    </div>
  );
}
