import { useNavigate } from 'react-router-dom';
import { fmtCompact } from '../../utils/ccCategories.js';

export default function CCDoneScreen({ synced, failed, dueDate, totalDue, onSetReminder, reminderSet }) {
  const navigate = useNavigate();

  const daysLeft = dueDate
    ? Math.ceil((new Date(dueDate) - new Date()) / 86400000)
    : null;

  return (
    <div className="flex flex-col items-center py-12 px-5 gap-6">
      {/* Success icon */}
      <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-xl font-bold text-gray-900">{synced} Transaction{synced !== 1 ? 's' : ''} Synced!</p>
        <p className="text-sm text-gray-400 mt-1">Your expenses are now in FinTracker</p>
      </div>

      {/* Stats */}
      <div className="w-full grid grid-cols-2 gap-3">
        <div className="bg-green-50 rounded-2xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-600">{synced}</p>
          <p className="text-xs text-green-500 font-medium">Added</p>
        </div>
        {failed > 0 ? (
          <div className="bg-red-50 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-red-500">{failed}</p>
            <p className="text-xs text-red-400 font-medium">Failed</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-800">0</p>
            <p className="text-xs text-gray-400 font-medium">Errors</p>
          </div>
        )}
      </div>

      {/* Due date reminder card */}
      {dueDate && (
        <div className={`w-full rounded-2xl px-4 py-4 space-y-3 ${daysLeft !== null && daysLeft <= 5 ? 'bg-orange-50' : 'bg-brand-50'}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${daysLeft !== null && daysLeft <= 5 ? 'text-orange-500' : 'text-brand'}`}>
                Payment Due
              </p>
              <p className="text-base font-bold text-gray-800 mt-0.5">{fmtCompact(totalDue)}</p>
              <p className="text-xs text-gray-500">
                {new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                {daysLeft !== null && (
                  <span className={`ml-2 font-semibold ${daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-orange-500' : 'text-green-600'}`}>
                    ({daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'})
                  </span>
                )}
              </p>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={daysLeft !== null && daysLeft <= 5 ? '#F97316' : '#1A6BFF'} strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>

          <button
            onClick={onSetReminder}
            disabled={reminderSet}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
              reminderSet
                ? 'bg-green-100 text-green-600'
                : daysLeft !== null && daysLeft <= 5
                ? 'bg-orange-500 text-white'
                : 'bg-brand text-white'
            }`}
          >
            {reminderSet ? '✓ Reminder Set in Google Calendar' : 'Set Payment Reminder in Calendar'}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="w-full space-y-3">
        <button
          onClick={() => navigate('/transactions')}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
          View in Transactions
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-3.5 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold"
        >
          Parse Another Statement
        </button>
      </div>
    </div>
  );
}
