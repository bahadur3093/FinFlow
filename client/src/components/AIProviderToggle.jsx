import { useState } from 'react';

export const AI_PROVIDER_KEY = 'ai_provider';

export function getAIProvider() {
  return localStorage.getItem(AI_PROVIDER_KEY) || 'gemini';
}

/** Gemini logo mark (colourful G) */
function GeminiIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4"/>
      <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/** Simple Ollama spark icon */
function OllamaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
    </svg>
  );
}

/**
 * Pill toggle to switch between Gemini and Ollama.
 *
 * Props:
 *   onChange(provider: 'gemini' | 'ollama') — called whenever the user switches
 */
export default function AIProviderToggle({ onChange }) {
  const [provider, setProvider] = useState(getAIProvider);

  const select = (p) => {
    if (p === provider) return;
    setProvider(p);
    localStorage.setItem(AI_PROVIDER_KEY, p);
    onChange?.(p);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">AI</span>
      <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
        <button
          type="button"
          onClick={() => select('gemini')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
            provider === 'gemini'
              ? 'bg-white text-brand shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <GeminiIcon />
          Gemini
        </button>
        <button
          type="button"
          onClick={() => select('ollama')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
            provider === 'ollama'
              ? 'bg-white text-gray-700 shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <OllamaIcon />
          Ollama
        </button>
      </div>
    </div>
  );
}
