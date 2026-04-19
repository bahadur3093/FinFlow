import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import AIProviderToggle, { getAIProvider } from '../components/AIProviderToggle.jsx';

// ── Suggested starters ───────────────────────────────────────────────────────

const SUGGESTIONS = [
  'How much did I spend this month?',
  'Which category am I overspending on?',
  'What is my current balance?',
  'How can I reduce my monthly expenses?',
  'Give me a summary of my finances',
];

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────────

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[78%] px-4 py-3 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-brand text-white rounded-tr-lg'
            : 'bg-white text-gray-800 rounded-tl-lg shadow-card'
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OllamaChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [provider, setProvider]   = useState(getAIProvider);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  const handleProviderChange = (p) => {
    setProvider(p);
    setMessages([]);
    setError('');
    setInput('');
  };

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    setInput('');
    setError('');

    const userMsg = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const { data } = await api.post('/ai/chat', { messages: next }, {
        headers: { 'x-ai-provider': provider },
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reach FinBot. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError('');
    setInput('');
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-screen">
      {/* ── Header ── */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-5 overflow-hidden flex-shrink-0">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white opacity-5" />

        <div className="relative z-10">
          <button
            onClick={() => navigate('/tools')}
            className="flex items-center gap-1.5 text-white/70 text-xs mb-3 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Tools
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-white text-lg font-bold leading-tight">FinBot</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white/90">BETA</span>
                </div>
                <p className="text-white/70 text-xs">
                  {provider === 'gemini' ? 'Powered by Gemini · has access to your data' : 'Powered by Ollama · Text-to-SQL agent'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-white/10 rounded-2xl px-2 py-1.5 backdrop-blur-sm">
                <AIProviderToggle onChange={handleProviderChange} />
              </div>
              {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 text-white/60 text-xs hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Clear
              </button>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-surface">

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full pb-10 gap-5">
            <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-gray-800 font-bold text-base">Ask FinBot anything</p>
              <p className="text-xs text-gray-400 mt-1">Knows your real transactions, budgets & loans</p>
            </div>
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-2xl px-3 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <p className="text-xs text-green-700 font-medium">Live data connected · answers based on your account</p>
            </div>

            {/* Suggestion chips */}
            <div className="w-full space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-white border border-gray-100 shadow-card text-sm text-gray-700 font-medium active:scale-[0.98] transition-transform flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="bg-white rounded-3xl rounded-tl-lg shadow-card">
              <TypingDots />
            </div>
          </div>
        )}

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

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 px-4 py-3 pb-safe bg-white border-t border-gray-100">
        <div className="flex items-end gap-2.5">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // auto-grow (max ~4 lines)
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about budgeting, saving, debt…"
            disabled={loading}
            className="flex-1 resize-none px-4 py-3 rounded-2xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors disabled:opacity-50 overflow-hidden"
            style={{ minHeight: '46px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-300 text-center mt-2">
          FinBot may make mistakes · Beta
        </p>
      </div>
    </div>
  );
}
