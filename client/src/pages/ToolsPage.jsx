import { useNavigate } from 'react-router-dom';

const tools = [
  {
    to: '/tools/jobs',
    title: 'Job Finder AI',
    description: 'Scrape LinkedIn, Naukri, Indeed & Glassdoor live — AI scores each job by your skills & experience',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/>
        <line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
    badge: 'New',
    badgeColor: 'bg-brand-50 text-brand',
  },
  {
    to: '/tools/finbot',
    title: 'FinBot AI Chat',
    description: 'Chat with an Ollama-powered finance assistant — budgeting tips, saving advice, and more',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    badge: 'Beta',
    badgeColor: 'bg-amber-50 text-amber-600',
  },
  {
    to: '/credit-card',
    title: 'Credit Card Statement',
    description: 'Upload your CC statement PDF, extract all transactions with AI, and sync to FinTracker',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    badge: 'New',
    badgeColor: 'bg-brand-50 text-brand',
  },
  {
    to: '/tools/connect-claude',
    title: 'Connect Claude AI',
    description: 'Ask Claude about your finances — spending, budgets, loans and more',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#EEF4FF" />
        <path
          d="M8.5 15.5L12 8l3.5 7.5M9.5 13.5h5"
          stroke="#1A6BFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    badge: 'New',
    badgeColor: 'bg-brand-50 text-brand',
  },
  {
    to: '/tools/pdf-unlocker',
    title: 'PDF Unlocker',
    description: 'Remove password protection from any PDF file instantly',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        <circle cx="12" cy="16" r="1" fill="#1A6BFF" />
      </svg>
    ),
    badge: 'Free',
    badgeColor: 'bg-green-50 text-green-600',
  },
];

export default function ToolsPage() {
  const navigate = useNavigate();

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-dark via-brand to-brand-light px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white opacity-5" />
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">Tools</h1>
            <p className="text-white/70 text-xs">Handy utilities to get things done</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Available Tools</p>

        {tools.map((tool) => (
          <button
            key={tool.to}
            onClick={() => navigate(tool.to)}
            className="card w-full text-left flex items-center gap-4 active:scale-[0.98] transition-transform"
          >
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-gray-800">{tool.title}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tool.badgeColor}`}>
                  {tool.badge}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-snug">{tool.description}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}

        <div className="bg-brand-50 rounded-2xl px-4 py-4 text-center">
          <p className="text-xs font-semibold text-brand">More tools coming soon</p>
          <p className="text-xs text-brand/60 mt-0.5">We're adding new utilities to help you work smarter</p>
        </div>
      </div>
    </div>
  );
}
