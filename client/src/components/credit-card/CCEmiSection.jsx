import { useState } from 'react';
import { fmt } from '../../utils/ccCategories.js';

function EmiCard({ emi }) {
  const [open, setOpen] = useState(false);
  const progress = Math.round((emi.emi_number / emi.total_emis) * 100);

  return (
    <div className="border border-blue-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 text-left"
      >
        <div>
          <p className="text-sm font-bold text-gray-800">{emi.merchant}</p>
          <p className="text-xs text-blue-500 font-medium">
            EMI {emi.emi_number} of {emi.total_emis} · {fmt(emi.total_emi_amount)} this month
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3 bg-white">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Progress</span>
              <span>{emi.emi_number}/{emi.total_emis} paid</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full bg-blue-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Breakdown grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-xl px-2 py-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium">Principal</p>
              <p className="text-xs font-bold text-gray-800">{fmt(emi.principal)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-2 py-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium">Interest</p>
              <p className="text-xs font-bold text-gray-800">{fmt(emi.interest)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-2 py-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium">GST</p>
              <p className="text-xs font-bold text-gray-800">{fmt(emi.gst)}</p>
            </div>
          </div>

          {emi.loan_ref && (
            <p className="text-xs text-gray-400">Ref: {emi.loan_ref}</p>
          )}
          {emi.original_purchase_date && (
            <p className="text-xs text-gray-400">
              Purchased: {new Date(emi.original_purchase_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CCEmiSection({ emis }) {
  if (!emis?.length) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-800">Active EMIs</p>
        <span className="text-xs font-bold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">{emis.length}</span>
      </div>
      <div className="space-y-2">
        {emis.map((emi, i) => <EmiCard key={i} emi={emi} />)}
      </div>
    </div>
  );
}
