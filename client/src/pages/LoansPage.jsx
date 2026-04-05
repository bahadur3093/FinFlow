import { useState, useEffect } from 'react';
import api from '../services/api.js';
import { useSocket } from '../context/SocketContext.jsx';

const LOAN_TYPES = [
  { value: 'home',      label: 'Home Loan',      icon: '🏠', color: 'bg-blue-50   text-blue-600'   },
  { value: 'car',       label: 'Car Loan',        icon: '🚗', color: 'bg-orange-50 text-orange-600' },
  { value: 'personal',  label: 'Personal Loan',   icon: '👤', color: 'bg-purple-50 text-purple-600' },
  { value: 'education', label: 'Education Loan',  icon: '🎓', color: 'bg-green-50  text-green-600'  },
  { value: 'other',     label: 'Other',           icon: '📋', color: 'bg-gray-50   text-gray-600'   },
];

const fmt = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
}).format(n);

const getLoanType = (type) => LOAN_TYPES.find(t => t.value === type) || LOAN_TYPES[4];

// Calculate months remaining based on outstanding and EMI
const calcMonthsLeft = (outstanding, emi, interestRate) => {
  if (emi <= 0) return 0;
  const r = interestRate / 100 / 12;
  if (r === 0) return Math.ceil(outstanding / emi);
  return Math.ceil(Math.log(emi / (emi - outstanding * r)) / Math.log(1 + r));
};

// Calculate total interest remaining
const calcInterestRemaining = (outstanding, emi, interestRate) => {
  const months = calcMonthsLeft(outstanding, emi, interestRate);
  return Math.max((emi * months) - outstanding, 0);
};

const EMPTY_FORM = {
  name: '', type: 'personal', principal: '', outstanding: '',
  emi: '', interestRate: '', tenureMonths: '', startDate: ''
};

function AddLoanSheet({ onClose, onSaved, editLoan }) {
  const [form, setForm] = useState(editLoan ? {
    ...editLoan,
    startDate: new Date(editLoan.startDate).toISOString().split('T')[0]
  } : EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = editLoan
        ? await api.put(`/loans/${editLoan.id}`, form)
        : await api.post('/loans', form);
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save loan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-bold text-gray-900 mb-5">
          {editLoan ? 'Edit loan' : 'Add loan'}
        </h3>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 text-sm text-red-500">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Loan name</label>
            <input name="name" value={form.name} onChange={handleChange}
              required placeholder="e.g. HDFC Home Loan" className="input-field" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Loan type</label>
            <div className="grid grid-cols-3 gap-2">
              {LOAN_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`py-2.5 rounded-2xl text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    form.type === t.value ? 'bg-brand text-white' : 'bg-gray-50 text-gray-600'
                  }`}>
                  <span>{t.icon}</span>
                  <span>{t.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Principal (₹)</label>
              <input name="principal" type="number" value={form.principal} onChange={handleChange}
                required placeholder="1000000" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Outstanding (₹)</label>
              <input name="outstanding" type="number" value={form.outstanding} onChange={handleChange}
                required placeholder="800000" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">EMI (₹/month)</label>
              <input name="emi" type="number" value={form.emi} onChange={handleChange}
                required placeholder="15000" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Interest rate (%)</label>
              <input name="interestRate" type="number" step="0.01" value={form.interestRate}
                onChange={handleChange} required placeholder="8.5" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Tenure (months)</label>
              <input name="tenureMonths" type="number" value={form.tenureMonths} onChange={handleChange}
                required placeholder="240" className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Start date</label>
              <input name="startDate" type="date" value={form.startDate} onChange={handleChange}
                required className="input-field" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                  <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Saving...
              </span>
            ) : editLoan ? 'Save changes' : 'Add loan'}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoanCard({ loan, onEdit, onDelete }) {
  const type = getLoanType(loan.type);
  const paidPct = Math.min(((loan.principal - loan.outstanding) / loan.principal) * 100, 100);
  const monthsLeft = calcMonthsLeft(loan.outstanding, loan.emi, loan.interestRate);
  const interestLeft = calcInterestRemaining(loan.outstanding, loan.emi, loan.interestRate);
  const principalPaid = loan.principal - loan.outstanding;
  const totalPaid = loan.principal - loan.outstanding + (loan.emi * (loan.tenureMonths - monthsLeft) - principalPaid);

  const yearsLeft  = Math.floor(monthsLeft / 12);
  const mthsLeft   = monthsLeft % 12;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl ${type.color.split(' ')[0]}`}>
            {type.icon}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{loan.name}</p>
            <p className="text-xs text-gray-400">{type.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onEdit(loan)}
            className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2.5" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={() => onDelete(loan.id)}
            className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Outstanding vs Principal */}
      <div className="flex justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Outstanding</p>
          <p className="text-xl font-bold text-gray-900">{fmt(loan.outstanding)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">Principal</p>
          <p className="text-xl font-bold text-gray-400">{fmt(loan.principal)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
          <div className="h-full rounded-full bg-brand transition-all duration-700"
            style={{ width: `${paidPct}%` }} />
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-brand font-medium">{Math.round(paidPct)}% paid off</span>
          <span className="text-xs text-gray-400">
            {yearsLeft > 0 ? `${yearsLeft}y ` : ''}{mthsLeft}m left
          </span>
        </div>
      </div>

      {/* EMI + breakdown */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-brand-50 rounded-2xl p-3 text-center">
          <p className="text-sm font-bold text-brand">{fmt(loan.emi)}</p>
          <p className="text-xs text-brand/70">EMI/month</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-3 text-center">
          <p className="text-sm font-bold text-green-600">{fmt(principalPaid)}</p>
          <p className="text-xs text-green-500">Principal paid</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-3 text-center">
          <p className="text-sm font-bold text-red-500">{fmt(interestLeft)}</p>
          <p className="text-xs text-red-400">Interest left</p>
        </div>
      </div>

      {/* Interest rate badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Started {new Date(loan.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
        </span>
        <span className="text-xs font-semibold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full">
          {loan.interestRate}% p.a.
        </span>
      </div>
    </div>
  );
}

export default function LoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editLoan, setEditLoan] = useState(null);
  const { socket } = useSocket();

  useEffect(() => {
    api.get('/loans')
      .then(r => setLoans(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('loan:created', l  => setLoans(prev => [l, ...prev]));
    socket.on('loan:updated', l  => setLoans(prev => prev.map(x => x.id === l.id ? l : x)));
    socket.on('loan:deleted', id => setLoans(prev => prev.filter(x => x.id !== id)));
    return () => {
      socket.off('loan:created');
      socket.off('loan:updated');
      socket.off('loan:deleted');
    };
  }, [socket]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/loans/${id}`);
      setLoans(prev => prev.filter(l => l.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleSaved = (loan) => {
    if (editLoan) {
      setLoans(prev => prev.map(l => l.id === loan.id ? loan : l));
    }
    setEditLoan(null);
  };

  // Summary stats
  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
  const totalEMI         = loans.reduce((s, l) => s + l.emi, 0);
  const totalPrincipal   = loans.reduce((s, l) => s + l.principal, 0);
  const totalPaidOff     = loans.reduce((s, l) => s + (l.principal - l.outstanding), 0);
  const overallPct       = totalPrincipal > 0 ? (totalPaidOff / totalPrincipal) * 100 : 0;

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-16 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-white text-xl font-bold">Loans</h1>
          <button onClick={() => setShowAdd(true)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
        <p className="text-white/70 text-xs">Track all your loans in one place</p>
      </div>

      <div className="px-5 -mt-6 space-y-4">
        {/* Total debt overview card */}
        {loans.length > 0 && (
          <div className="card shadow-card-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Total outstanding</p>
                <p className="text-2xl font-bold text-gray-900">{fmt(totalOutstanding)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">Monthly EMIs</p>
                <p className="text-2xl font-bold text-red-500">{fmt(totalEMI)}</p>
              </div>
            </div>

            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full bg-brand transition-all duration-700"
                style={{ width: `${overallPct}%` }} />
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-brand font-medium">{Math.round(overallPct)}% paid off overall</span>
              <span className="text-xs text-gray-400">{loans.length} active loan{loans.length > 1 ? 's' : ''}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <p className="text-xs text-gray-500">
                Your EMIs take up <span className="font-semibold text-gray-700">{fmt(totalEMI)}</span> of your monthly expenses
              </p>
            </div>
          </div>
        )}

        {/* Loan cards */}
        {loading ? (
          Array(2).fill(0).map((_, i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gray-100 rounded-2xl" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-100 rounded-full w-1/2 mb-2" />
                  <div className="h-2 bg-gray-100 rounded-full w-1/3" />
                </div>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full" />
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl" />)}
              </div>
            </div>
          ))
        ) : loans.length === 0 ? (
          <div className="card text-center py-10">
            <div className="w-14 h-14 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.8" strokeLinecap="round">
                <rect x="2" y="5" width="20" height="14" rx="3"/>
                <path d="M2 10h20"/>
              </svg>
            </div>
            <p className="text-gray-700 font-semibold mb-1">No loans added yet</p>
            <p className="text-xs text-gray-400 mb-4">Add your loans to track EMIs and payoff progress</p>
            <button onClick={() => setShowAdd(true)}
              className="text-sm font-semibold text-white bg-brand px-6 py-2.5 rounded-2xl">
              Add first loan
            </button>
          </div>
        ) : (
          loans.map(loan => (
            <LoanCard key={loan.id} loan={loan}
              onEdit={l => { setEditLoan(l); setShowAdd(true); }}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {(showAdd || editLoan) && (
        <AddLoanSheet
          onClose={() => { setShowAdd(false); setEditLoan(null); }}
          onSaved={handleSaved}
          editLoan={editLoan}
        />
      )}
    </div>
  );
}