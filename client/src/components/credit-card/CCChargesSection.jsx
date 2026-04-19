import { fmt } from '../../utils/ccCategories.js';

const CHARGE_ICONS = {
  'Annual Fee':      { bg: 'bg-purple-50', stroke: '#A855F7' },
  'Late Payment':    { bg: 'bg-red-50',    stroke: '#EF4444' },
  'Interest':        { bg: 'bg-orange-50', stroke: '#F97316' },
  'Over Limit':      { bg: 'bg-red-50',    stroke: '#EF4444' },
  'Cash Advance':    { bg: 'bg-yellow-50', stroke: '#CA8A04' },
  'Other':           { bg: 'bg-gray-50',   stroke: '#6B7280' },
};

export default function CCChargesSection({ charges }) {
  if (!charges?.length) return null;

  const total = charges.reduce((sum, c) => sum + (c.amount || 0) + (c.gst || 0), 0);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-orange-50 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-800">Charges & Fees</p>
        </div>
        <p className="text-sm font-bold text-red-500">{fmt(total)}</p>
      </div>

      <div className="space-y-2">
        {charges.map((charge, i) => {
          const style = CHARGE_ICONS[charge.type] || CHARGE_ICONS['Other'];
          return (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.stroke} strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-700 truncate">{charge.description || charge.type}</p>
                {charge.gst > 0 && (
                  <p className="text-xs text-gray-400">
                    {fmt(charge.amount)} + GST {fmt(charge.gst)}
                  </p>
                )}
              </div>
              <p className="text-sm font-bold text-red-500 flex-shrink-0">
                {fmt(charge.amount + (charge.gst || 0))}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-orange-50 rounded-xl px-3 py-2">
        <p className="text-xs text-orange-500 font-medium">
          Charges are not included in the expense sync by default. Toggle above to include them.
        </p>
      </div>
    </div>
  );
}
