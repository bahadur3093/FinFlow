import { useState, useRef } from 'react';
import api from '../services/api.js';
import AIProviderToggle, { getAIProvider } from '../components/AIProviderToggle.jsx';

const CATEGORY_COLORS = {
  Food:          { bg: 'bg-red-50',    text: 'text-red-500'    },
  Transport:     { bg: 'bg-blue-50',   text: 'text-blue-500'   },
  Shopping:      { bg: 'bg-purple-50', text: 'text-purple-500' },
  Entertainment: { bg: 'bg-orange-50', text: 'text-orange-500' },
  Health:        { bg: 'bg-green-50',  text: 'text-green-500'  },
  Utilities:     { bg: 'bg-yellow-50', text: 'text-yellow-600' },
  Salary:        { bg: 'bg-brand-50',  text: 'text-brand'      },
  Other:         { bg: 'bg-gray-50',   text: 'text-gray-500'   },
};

const fmt = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
}).format(n);

const STEPS = ['upload', 'parsing', 'review', 'done'];

function StepIndicator({ current }) {
  const labels = ['Upload', 'Parsing', 'Review', 'Done'];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {labels.map((label, i) => {
        const idx = STEPS.indexOf(current);
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? 'bg-green-500 text-white' : active ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                ) : i + 1}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-brand' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 rounded-full ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function UploadPage() {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [provider, setProvider] = useState(getAIProvider);
  const fileRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(f.type)) {
      setError('Please upload a PDF or image file (PNG, JPG)');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB');
      return;
    }
    setError('');
    setFile(f);
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleParse = async () => {
    if (!file) return;
    setStep('parsing');
    setError('');
    try {
      const formData = new FormData();
      formData.append('statement', file);
      const { data } = await api.post('/ai/parse-statement', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-ai-provider': provider,
        },
      });
      setParsed(data.transactions);
      setStep('review');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse statement. Try again.');
      setStep('upload');
    }
  };

  const handleConfirm = () => setStep('done');

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setParsed([]);
    setError('');
  };

  const totalImported  = parsed.length;
  const importedIncome  = parsed.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const importedExpense = parsed.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="flex items-start justify-between z-10 relative">
          <div>
            <h1 className="text-white text-xl font-bold mb-1">AI Statement Parser</h1>
            <p className="text-white/70 text-xs">Upload your bank statement and let AI extract all transactions</p>
          </div>
          <div className="bg-white/10 rounded-2xl px-2 py-1.5 backdrop-blur-sm">
            <AIProviderToggle onChange={setProvider} />
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-4">
        <div className="card z-1 relative">
          <StepIndicator current={step} />

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-2xl bg-red-50 text-sm text-red-500">{error}</div>
              )}

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileRef.current.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-brand bg-brand-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}>
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden" onChange={e => handleFile(e.target.files[0])} />

                {file ? (
                  <div className="space-y-3">
                    {preview ? (
                      <img src={preview} alt="preview" className="w-24 h-24 object-cover rounded-2xl mx-auto" />
                    ) : (
                      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                    )}
                    <p className="text-sm font-semibold text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                    <button type="button" onClick={e => { e.stopPropagation(); handleReset(); }}
                      className="text-xs text-red-400 font-medium">Remove</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Drop your statement here</p>
                      <p className="text-xs text-gray-400 mt-1">or tap to browse · PDF, PNG, JPG up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Supported banks note */}
              <div className="bg-brand-50 rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-brand mb-1">How it works</p>
                <p className="text-xs text-brand/70">
                  {provider === 'ollama'
                    ? 'Ollama (llava) reads your statement image and extracts all transactions. Switch to Gemini for PDF files.'
                    : 'Gemini AI reads your statement and automatically extracts, categorises, and imports all transactions into FinFlow.'}
                </p>
              </div>

              <button onClick={handleParse} disabled={!file}
                className="btn-primary disabled:opacity-40">
                Parse with AI
              </button>
            </div>
          )}

          {/* Step: Parsing */}
          {step === 'parsing' && (
            <div className="py-10 text-center space-y-5">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
                <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" strokeOpacity="0.2"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-gray-900 font-bold text-base">Analysing statement...</p>
                <p className="text-xs text-gray-400 mt-1">
                  {provider === 'ollama' ? 'Ollama is reading and extracting transactions' : 'Gemini AI is reading and extracting transactions'}
                </p>
              </div>
              <div className="space-y-2 text-left bg-gray-50 rounded-2xl px-4 py-3">
                {['Reading document...', 'Identifying transactions...', 'Categorising entries...'].map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin"
                      style={{ animationDelay: `${i * 0.3}s` }} />
                    <span className="text-xs text-gray-500">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-brand-50 rounded-2xl p-3 text-center">
                  <p className="text-xl font-bold text-brand">{totalImported}</p>
                  <p className="text-xs text-brand/70">transactions</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-3 text-center">
                  <p className="text-sm font-bold text-green-600">{fmt(importedIncome)}</p>
                  <p className="text-xs text-green-500">income</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-3 text-center">
                  <p className="text-sm font-bold text-red-500">{fmt(importedExpense)}</p>
                  <p className="text-xs text-red-400">expenses</p>
                </div>
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extracted transactions</p>

              <div className="max-h-80 overflow-y-auto space-y-0 rounded-2xl overflow-hidden border border-gray-100">
                {parsed.map((tx, i) => {
                  const colors = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.Other;
                  return (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 bg-white ${i < parsed.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${colors.bg} ${colors.text}`}>
                        {tx.category?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{tx.description}</p>
                        <p className="text-xs text-gray-400">{tx.category} · {tx.date}</p>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={handleReset}
                  className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold">
                  Cancel
                </button>
                <button onClick={handleConfirm}
                  className="flex-1 py-3.5 rounded-2xl bg-brand text-white text-sm font-semibold">
                  Import all
                </button>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="py-10 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <div>
                <p className="text-gray-900 font-bold text-lg">Import complete!</p>
                <p className="text-sm text-gray-400 mt-1">
                  {totalImported} transactions imported successfully
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-2xl p-3 text-center">
                  <p className="text-sm font-bold text-green-600">{fmt(importedIncome)}</p>
                  <p className="text-xs text-green-500">income added</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-3 text-center">
                  <p className="text-sm font-bold text-red-500">{fmt(importedExpense)}</p>
                  <p className="text-xs text-red-400">expenses added</p>
                </div>
              </div>
              <button onClick={handleReset} className="btn-primary">
                Upload another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}