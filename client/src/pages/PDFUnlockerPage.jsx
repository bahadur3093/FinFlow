import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';

const STEPS = ['select', 'uploading', 'processing', 'done', 'error'];

function ProgressBar({ percent }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default function PDFUnlockerPage() {
  const navigate = useNavigate();
  const fileRef = useRef();

  const [step, setStep] = useState('select');
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [processingMsg, setProcessingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadName, setDownloadName] = useState('');

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setErrorMsg('Please upload a PDF file.');
      setStep('error');
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setErrorMsg('File must be under 50 MB.');
      setStep('error');
      return;
    }
    setFile(f);
    setStep('select');
    setErrorMsg('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUnlock = async () => {
    if (!file || !password) return;

    setStep('uploading');
    setUploadPercent(0);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('password', password);

      const response = await api.post('/tools/unlock-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        onUploadProgress: (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
          setUploadPercent(pct);
          if (pct === 100) {
            setStep('processing');
            setProcessingMsg('Decrypting PDF…');
          }
        },
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const name = file.name.replace(/\.pdf$/i, '') + '-unlocked.pdf';

      setDownloadUrl(url);
      setDownloadName(name);
      setStep('done');
    } catch (err) {
      let msg = 'Something went wrong. Please try again.';
      if (err.response?.data) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.error || msg;
        } catch {
          /* ignore */
        }
      }
      setErrorMsg(msg);
      setStep('error');
    }
  };

  const handleReset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setStep('select');
    setFile(null);
    setPassword('');
    setUploadPercent(0);
    setDownloadUrl(null);
    setDownloadName('');
    setErrorMsg('');
    setProcessingMsg('');
  };

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white opacity-5" />
        <button
          onClick={() => navigate('/tools')}
          className="flex items-center gap-1.5 text-white/70 text-xs mb-3 hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Tools
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              <circle cx="12" cy="16" r="1" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">PDF Unlocker</h1>
            <p className="text-white/70 text-xs">Remove password protection from your PDF</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6">
        <div className="card space-y-5">

          {/* Select step */}
          {(step === 'select' || step === 'error') && (
            <>
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
                        <line x1="9" y1="12" x2="15" y2="12" />
                        <line x1="9" y1="16" x2="13" y2="16" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 break-all line-clamp-3">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleReset(); }}
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
                      <p className="text-sm font-semibold text-gray-700">Drop your PDF here</p>
                      <p className="text-xs text-gray-400 mt-1">or tap to browse · PDF up to 50 MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  PDF Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter the PDF password"
                    className="input-field pr-12"
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
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

              {/* Error message */}
              {step === 'error' && errorMsg && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-sm text-red-500">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={handleUnlock}
                disabled={!file || !password}
                className="btn-primary disabled:opacity-40"
              >
                Unlock PDF
              </button>

              <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500">How it works</p>
                {[
                  'Upload your password-protected PDF',
                  'Enter the PDF password',
                  'Download the unlocked file — no password needed to open it',
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-brand-50 text-brand text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-gray-400">{s}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Uploading step */}
          {step === 'uploading' && (
            <div className="py-8 space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
                <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-900 font-bold text-base">Uploading PDF…</p>
                <p className="text-xs text-gray-400 mt-1">{uploadPercent}% uploaded</p>
              </div>

              <div className="space-y-2">
                <ProgressBar percent={uploadPercent} />
                <div className="flex justify-between">
                  <span className="text-xs text-gray-400 break-all line-clamp-2">{file?.name}</span>
                  <span className="text-xs text-brand font-semibold">{uploadPercent}%</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-brand border-t-transparent animate-spin flex-shrink-0" />
                <span className="text-xs text-gray-500">Securely transferring your file…</span>
              </div>
            </div>
          )}

          {/* Processing step */}
          {step === 'processing' && (
            <div className="py-8 space-y-6 text-center">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-brand-100" />
                <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </svg>
                </div>
              </div>

              <div>
                <p className="text-gray-900 font-bold text-base">Decrypting PDF…</p>
                <p className="text-xs text-gray-400 mt-1">Removing password protection</p>
              </div>

              <div className="space-y-2 text-left bg-gray-50 rounded-2xl px-4 py-3">
                {[
                  { label: 'Upload complete', done: true },
                  { label: processingMsg || 'Decrypting with provided password…', done: false },
                  { label: 'Preparing download…', done: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {s.done ? (
                      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                    ) : (
                      <div
                        className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin flex-shrink-0"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    )}
                    <span className="text-xs text-gray-500">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done step */}
          {step === 'done' && (
            <div className="py-8 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <div>
                <p className="text-gray-900 font-bold text-lg">PDF Unlocked!</p>
                <p className="text-sm text-gray-400 mt-1">Password protection has been removed</p>
              </div>

              <div className="bg-green-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div className="flex-1 text-left">
                  <p className="text-xs font-semibold text-green-700 break-all line-clamp-2">{downloadName}</p>
                  <p className="text-xs text-green-500">Ready to download</p>
                </div>
              </div>

              <a
                href={downloadUrl}
                download={downloadName}
                className="btn-primary flex items-center justify-center gap-2 no-underline"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Unlocked PDF
              </a>

              <button
                onClick={handleReset}
                className="w-full py-3.5 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold"
              >
                Unlock another PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
