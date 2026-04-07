import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import api from '../services/api.js';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
];

function Avatar({ name, size = 'lg' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const sz = size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full bg-brand-100 flex items-center justify-center text-brand font-bold`}>
      {initials}
    </div>
  );
}

function SettingRow({ label, value, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${danger ? 'text-red-500' : ''}`}>
      <span className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-gray-700'}`}>{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-400">{value}</span>}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={danger ? '#EF4444' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="card p-0 overflow-hidden">
      {title && (
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
          {title}
        </p>
      )}
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function EditNameSheet({ user, onClose, onSaved }) {
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/auth/profile', { name });
      onSaved(name);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-bold text-gray-900 mb-5">Edit name</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Full name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              required className="input-field" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

function CurrencySheet({ current, onClose, onSelect }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-bold text-gray-900 mb-5">Select currency</h3>
        <div className="space-y-2">
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => { onSelect(c); onClose(); }}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all ${
                current.code === c.code
                  ? 'bg-brand text-white'
                  : 'bg-gray-50 text-gray-700'
              }`}>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold w-8">{c.symbol}</span>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${current.code === c.code ? 'text-white' : 'text-gray-800'}`}>
                    {c.code}
                  </p>
                  <p className={`text-xs ${current.code === c.code ? 'text-white/70' : 'text-gray-400'}`}>
                    {c.label}
                  </p>
                </div>
              </div>
              {current.code === c.code && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LogoutConfirmSheet({ onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-3xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Sign out?</h3>
          <p className="text-sm text-gray-400">You'll need to sign in again to access your account.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white text-sm font-semibold">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, setAuth } = useAuthStore();
  const [sheet, setSheet] = useState(null); // 'editName' | 'currency' | 'logout'
  const [currency, setCurrency] = useState(
    JSON.parse(localStorage.getItem('finflow-currency') || null) ||
    { code: 'INR', symbol: '₹', label: 'Indian Rupee' }
  );

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleCurrencySelect = (c) => {
    setCurrency(c);
    localStorage.setItem('finflow-currency', JSON.stringify(c));
  };

  const handleNameSaved = (name) => {
    setAuth({ ...user, name }, useAuthStore.getState().accessToken, useAuthStore.getState().refreshToken);
  };

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <h1 className="text-white text-xl font-bold">Profile</h1>
      </div>

      <div className="px-5 mt-6 space-y-4">
        {/* Profile card */}
        <div className="card shadow-card-lg">
          <div className="flex items-center gap-4 mt-8">
            <Avatar name={user?.name} />
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-gray-900 truncate">{user?.name}</p>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            </div>
            <button onClick={() => setSheet('editName')}
              className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Preferences */}
        <Section title="Preferences">
          <SettingRow
            label="Currency"
            value={`${currency.symbol} ${currency.code}`}
            onClick={() => setSheet('currency')}
          />
          <SettingRow
            label="Notifications"
            value="Enabled"
            onClick={() => {}}
          />
        </Section>

        {/* About */}
        <Section title="About">
          <SettingRow label="Version" value="1.0.0" onClick={() => {}} />
          <SettingRow label="Privacy Policy" onClick={() => {}} />
          <SettingRow label="Terms of Service" onClick={() => {}} />
        </Section>

        {/* Danger zone */}
        <Section>
          <SettingRow
            label="Sign out"
            danger
            onClick={() => setSheet('logout')}
          />
        </Section>
      </div>

      {sheet === 'editName'  && <EditNameSheet user={user} onClose={() => setSheet(null)} onSaved={handleNameSaved} />}
      {sheet === 'currency'  && <CurrencySheet current={currency} onClose={() => setSheet(null)} onSelect={handleCurrencySelect} />}
      {sheet === 'logout'    && <LogoutConfirmSheet onClose={() => setSheet(null)} onConfirm={handleLogout} />}
    </div>
  );
}