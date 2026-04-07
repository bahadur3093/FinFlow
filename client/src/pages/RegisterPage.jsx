import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';

const strengthConfig = [
  { label: '', color: '' },
  { label: 'Weak',   color: 'bg-red-400' },
  { label: 'Fair',   color: 'bg-amber-400' },
  { label: 'Good',   color: 'bg-yellow-400' },
  { label: 'Strong', color: 'bg-brand' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const strength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name, email: form.email, password: form.password
      });
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="relative h-44 bg-gradient-to-br from-brand-dark via-brand to-brand-light flex flex-col items-center justify-end pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white opacity-5" />
        <div className="absolute -bottom-6 -left-6 w-36 h-36 rounded-full bg-white opacity-5" />
        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mb-3">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M5 21 L14 5 L23 21" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.5 15 h11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="text-white text-xl font-bold tracking-tight">FinFlow</h1>
      </div>

      <div className="flex-1 px-5 pt-6 pb-10">
        <div className="card shadow-card-lg">
          <h2 className="text-xl font-bold text-gray-900 mt-2 mb-1">Create account</h2>
          <p className="text-sm text-gray-400 mb-6">Start your financial journey</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-500 flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Full name</label>
              <input type="text" name="name" value={form.name} onChange={handleChange}
                required placeholder="John Doe" className="input-field" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Email address</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                required placeholder="you@example.com" className="input-field" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} required placeholder="Min. 8 characters"
                  className="input-field pr-12" />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-2.5">
                  <div className="flex gap-1.5 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthConfig[strength].color : 'bg-gray-100'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    Strength: <span className="font-semibold text-gray-600">{strengthConfig[strength].label}</span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Confirm password</label>
              <input type="password" name="confirm" value={form.confirm} onChange={handleChange}
                required placeholder="••••••••"
                className={`input-field ${form.confirm && form.confirm !== form.password ? 'ring-2 ring-red-300 border-red-300' : ''}`} />
              {form.confirm && form.confirm !== form.password && (
                <p className="text-xs text-red-400 mt-1.5">Passwords don't match</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}