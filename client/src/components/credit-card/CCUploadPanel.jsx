import { useState, useRef } from 'react';

const PASSWORD_HINTS = [
  { id: 'dob',   label: 'Date of Birth', example: 'DDMMYYYY  e.g. 15081990' },
  { id: 'last4', label: 'Last 4 digits of card', example: 'e.g. 4321' },
  { id: 'custom', label: 'Other / Custom', example: '' },
];

export default function CCUploadPanel({ onFileReady, error, loading }) {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hintId, setHintId] = useState('dob');

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') return;
    if (f.size > 50 * 1024 * 1024) return;
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = () => {
    if (!file || !password || loading) return;
    onFileReady(file, password);
  };

  const hint = PASSWORD_HINTS.find((h) => h.id === hintId);

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !file && fileRef.current.click()}
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
          dragOver
            ? 'border-brand bg-brand-50 cursor-copy'
            : file
            ? 'border-green-400 bg-green-50'
            : 'border-gray-200 bg-gray-50 cursor-pointer'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {file ? (
          <div className="space-y-2">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700 break-all line-clamp-2">{file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="text-xs text-red-400 font-medium"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-16 h-16 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Drop your CC statement here</p>
              <p className="text-xs text-gray-400 mt-1">or tap to browse · PDF up to 50 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Password hint selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password Format</p>
        <div className="grid grid-cols-3 gap-2">
          {PASSWORD_HINTS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHintId(h.id)}
              className={`text-center px-2 py-2.5 rounded-2xl border text-[11px] font-semibold transition-all leading-tight ${
                hintId === h.id
                  ? 'border-brand bg-brand-50 text-brand'
                  : 'border-gray-200 text-gray-400'
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
        {hint?.example && (
          <p className="text-[11px] text-gray-400 pl-1">{hint.example}</p>
        )}
      </div>

      {/* Password input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          PDF Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              hintId === 'dob' ? 'e.g. 15081990'
              : hintId === 'last4' ? 'e.g. 4321'
              : 'Enter PDF password'
            }
            className="input-field pr-12"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || !password || loading}
        className="btn-primary disabled:opacity-40"
      >
        {loading ? 'Processing…' : 'Unlock & Parse Statement'}
      </button>

      {/* Info strip */}
      <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-1.5">
        <p className="text-xs font-semibold text-gray-500">How it works</p>
        {[
          'Upload your password-protected CC statement PDF',
          'We unlock it using your password (never stored)',
          'Claude AI extracts every transaction in one pass',
          'Review, edit categories, then sync to FinTracker',
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-brand-50 text-brand text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <p className="text-xs text-gray-400">{s}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
