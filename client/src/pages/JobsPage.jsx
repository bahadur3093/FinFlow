import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import JobCard from '../components/jobs/JobCard.jsx';
import LiveScraperView from '../components/jobs/LiveScraperView.jsx';
import AIProviderToggle, { getAIProvider } from '../components/AIProviderToggle.jsx';

const TABS = ['Profile', 'Scraper', 'Results'];

const SKILL_SUGGESTIONS = [
  'React', 'Node.js', 'TypeScript', 'Python', 'Java', 'AWS', 'Docker', 'Kubernetes',
  'SQL', 'MongoDB', 'GraphQL', 'Next.js', 'Flutter', 'Swift', 'Go', 'Rust',
  'Machine Learning', 'Data Analysis', 'Figma', 'DevOps', 'Spring Boot',
];

const PLATFORM_META = [
  { key: 'linkedin',  label: 'LinkedIn',  color: '#0A66C2', icon: '💼' },
  { key: 'naukri',    label: 'Naukri',    color: '#FF7555', icon: '🔍' },
  { key: 'indeed',    label: 'Indeed',    color: '#2557A7', icon: '📋' },
  { key: 'glassdoor', label: 'Glassdoor', color: '#0CAA41', icon: '🚪' },
];

// ── Connected Portals ─────────────────────────────────────────────────────────

function ConnectedPortals({ socket }) {
  const [platforms, setPlatforms] = useState([]);
  const [connecting, setConnecting] = useState(null); // platform key being connected

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/jobs/platforms');
      setPlatforms(data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handlers = {
      'platform:login_started': () => {},
      'platform:connected': ({ platform }) => {
        setConnecting(null);
        setPlatforms((prev) =>
          prev.map((p) => p.platform === platform ? { ...p, connected: true, connectedAt: new Date().toISOString() } : p)
        );
      },
      'platform:login_timeout': ({ platform }) => {
        setConnecting(null);
        alert(`${platform} login timed out. Please try again.`);
      },
      'platform:login_error': ({ platform, message }) => {
        setConnecting(null);
        alert(`${platform} error: ${message}`);
      },
    };
    Object.entries(handlers).forEach(([e, fn]) => socket.on(e, fn));
    return () => Object.keys(handlers).forEach((e) => socket.off(e));
  }, [socket]);

  const connect = async (key) => {
    setConnecting(key);
    try {
      await api.post(`/jobs/platforms/${key}/connect`);
      // Result arrives via socket events
    } catch (e) {
      setConnecting(null);
      alert(e.message);
    }
  };

  const disconnect = async (key) => {
    if (!window.confirm(`Disconnect from ${key}? You'll scrape as a guest next time.`)) return;
    try {
      await api.delete(`/jobs/platforms/${key}`);
      setPlatforms((prev) => prev.map((p) => p.platform === key ? { ...p, connected: false, connectedAt: null } : p));
    } catch {}
  };

  return (
    <div className="card p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Connected Job Portals</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Log in once — sessions are saved and reused every scrape</p>
      </div>

      <div className="space-y-2">
        {PLATFORM_META.map(({ key, label, color, icon }) => {
          const status = platforms.find((p) => p.platform === key);
          const isConnected = status?.connected;
          const isConnecting = connecting === key;

          return (
            <div key={key} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
              <span className="text-xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800">{label}</p>
                {isConnected ? (
                  <p className="text-[10px] text-green-600">
                    ✓ Connected · {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ''}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400">Not connected · scrapes as guest</p>
                )}
              </div>
              {isConnecting ? (
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-brand">
                  <div className="w-3 h-3 border border-brand border-t-transparent rounded-full animate-spin" />
                  Waiting for login...
                </div>
              ) : isConnected ? (
                <button
                  onClick={() => disconnect(key)}
                  className="text-[10px] font-semibold text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connect(key)}
                  className="text-[10px] font-semibold text-white rounded-lg px-3 py-1.5"
                  style={{ background: color }}
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        Clicking Connect opens a real browser window — log in normally (including 2FA). The session is saved so you don't need to log in again.
      </p>
    </div>
  );
}

// ── Profile form ───────────────────────────────────────────────────────────────

function ProfileTab({ profile, onSaved, socket }) {
  const [form, setForm] = useState({
    targetRole: profile?.targetRole || '',
    experienceYears: profile?.experienceYears ?? 0,
    preferredLocations: profile?.preferredLocations?.join(', ') || '',
    summary: profile?.summary || '',
    skills: profile?.skills || [],
  });
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const addSkill = (skill) => {
    const s = skill.trim();
    if (s && !form.skills.includes(s)) {
      setForm((f) => ({ ...f, skills: [...f.skills, s] }));
    }
    setSkillInput('');
  };

  const removeSkill = (skill) => setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        preferredLocations: form.preferredLocations.split(',').map((l) => l.trim()).filter(Boolean),
      };
      const { data } = await api.post('/jobs/profile', payload);
      onSaved(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="card p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basic Info</p>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Target Role *</label>
          <input
            value={form.targetRole}
            onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}
            placeholder="e.g. Senior React Developer"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand transition-colors"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Years of Experience</label>
          <input
            type="number"
            min="0"
            max="40"
            value={form.experienceYears}
            onChange={(e) => setForm((f) => ({ ...f, experienceYears: parseInt(e.target.value) || 0 }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand transition-colors"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Preferred Locations</label>
          <input
            value={form.preferredLocations}
            onChange={(e) => setForm((f) => ({ ...f, preferredLocations: e.target.value }))}
            placeholder="e.g. Bangalore, Mumbai, Remote"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand transition-colors"
          />
          <p className="text-[10px] text-gray-400 mt-1">Comma-separated</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Professional Summary</label>
          <textarea
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            placeholder="Brief description of your background to help AI score jobs better..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand transition-colors resize-none"
          />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Skills</p>

        {/* Current skills */}
        <div className="flex flex-wrap gap-2">
          {form.skills.map((skill) => (
            <span
              key={skill}
              className="flex items-center gap-1.5 text-xs bg-brand-50 text-brand px-2.5 py-1 rounded-full font-medium"
            >
              {skill}
              <button type="button" onClick={() => removeSkill(skill)} className="text-brand/50 hover:text-brand">
                ×
              </button>
            </span>
          ))}
          {form.skills.length === 0 && <p className="text-xs text-gray-400">No skills added yet</p>}
        </div>

        {/* Skill input */}
        <div className="flex gap-2">
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput); } }}
            placeholder="Type a skill and press Enter"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand transition-colors"
          />
          <button
            type="button"
            onClick={() => addSkill(skillInput)}
            className="px-3 py-2 bg-brand text-white rounded-xl text-sm font-semibold"
          >
            Add
          </button>
        </div>

        {/* Quick-add suggestions */}
        <div>
          <p className="text-[10px] text-gray-400 mb-1.5">Quick add:</p>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_SUGGESTIONS.filter((s) => !form.skills.includes(s)).slice(0, 12).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full hover:bg-brand-50 hover:text-brand transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 rounded-2xl font-bold text-sm text-white transition-opacity"
        style={{ background: '#1A6BFF', opacity: saving ? 0.7 : 1 }}
      >
        {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Profile'}
      </button>

      <ConnectedPortals socket={socket} />
    </form>
  );
}

// ── Scraper tab ───────────────────────────────────────────────────────────────

function ScraperTab({ profile, socket }) {
  const [phase, setPhase] = useState('idle');
  const [screenshot, setScreenshot] = useState(null);
  const [statusMessages, setStatusMessages] = useState([]);
  const [platformStatuses, setPlatformStatuses] = useState({});
  const [jobCount, setJobCount] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [scoringProvider, setScoringProvider] = useState(getAIProvider);
  const navigate = useNavigate();

  const addLog = useCallback((text) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setStatusMessages((prev) => [...prev.slice(-49), { text, time }]);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handlers = {
      'scraper:start':      (d) => { setPhase('scraping'); setJobCount(0); setScreenshot(null); setPlatformStatuses({}); addLog(d.message); },
      'scraper:platform':   (d) => {
        setPlatformStatuses((prev) => ({ ...prev, [d.platform]: { status: d.status, count: d.count, timedOut: d.timedOut } }));
        if (d.status === 'done') {
          setJobCount((n) => n + (d.count || 0));
          addLog(`✓ ${d.platform}: ${d.count || 0} jobs found`);
        } else if (d.status === 'error') {
          addLog(`✗ ${d.platform}: ${d.message || 'failed'}`);
        } else {
          const loginLabel = d.loggedIn ? ' (logged in)' : ' (guest)';
          addLog(`→ Scraping ${d.platform}${loginLabel}...`);
        }
      },
      'scraper:status':     (d) => addLog(d.message),
      'scraper:screenshot': (d) => setScreenshot(d.imageBase64),
      'scraper:scoring':    (d) => { setPhase('scoring'); addLog(d.message); },
      'scraper:job_scored': (d) => addLog(`  Scored: ${d.job.title} at ${d.job.company} → ${d.job.score ?? 'N/A'}/100`),
      'scraper:complete':   (d) => { setPhase('complete'); setJobCount(d.total); addLog(d.message); },
      'scraper:error':      (d) => { setPhase('error'); addLog(`Error: ${d.message}`); },
    };

    Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));
    return () => Object.keys(handlers).forEach((event) => socket.off(event));
  }, [socket, addLog]);

  const startScraping = async () => {
    if (!profile) return;
    try {
      setPhase('scraping');
      setStatusMessages([]);
      setScreenshot(null);
      setPlatformStatuses({});
      setJobCount(0);
      const { data } = await api.post('/jobs/scrape', {}, { headers: { 'x-ai-provider': scoringProvider } });
      setSessionId(data.sessionId);
      addLog('Scraping request sent...');
    } catch (e) {
      setPhase('error');
      addLog(`Failed to start: ${e.message}`);
    }
  };

  if (!profile) {
    return (
      <div className="card p-6 text-center space-y-3">
        <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.6" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <p className="text-sm font-bold text-gray-700">Set up your profile first</p>
        <p className="text-xs text-gray-400">Add your skills and target role so the AI can score jobs for you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Profile summary */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A6BFF" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate">{profile.targetRole || 'No role set'}</p>
          <p className="text-xs text-gray-400 truncate">
            {profile.experienceYears}y exp · {profile.skills?.slice(0, 3).join(', ')}{profile.skills?.length > 3 ? ` +${profile.skills.length - 3}` : ''}
          </p>
        </div>
      </div>

      {/* Platforms info */}
      <div className="card p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Will scrape</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'LinkedIn',  color: '#0A66C2', icon: '💼' },
            { name: 'Naukri',    color: '#FF7555', icon: '🔍' },
            { name: 'Indeed',    color: '#2557A7', icon: '📋' },
            { name: 'Glassdoor', color: '#0CAA41', icon: '🚪' },
          ].map((p) => (
            <div key={p.name} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <span>{p.icon}</span>
              <span className="text-xs font-semibold text-gray-700">{p.name}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400">Up to 20 jobs per platform · AI-scored on each scrape</p>
      </div>

      {/* AI provider + Start button */}
      {(phase === 'idle' || phase === 'complete' || phase === 'error') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-400">Scoring provider</span>
            <AIProviderToggle onChange={(p) => { setScoringProvider(p); }} />
          </div>
          <button
            onClick={startScraping}
            className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1A6BFF, #0F6E56)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            {phase === 'complete' ? 'Scrape Again' : phase === 'error' ? 'Retry Scrape' : 'Start Scraping'}
          </button>
        </div>
      )}

      {/* View results button */}
      {phase === 'complete' && (
        <button
          onClick={() => navigate('/tools/jobs', { state: { tab: 2 } })}
          className="w-full py-3 rounded-2xl font-bold text-sm border-2 border-brand text-brand flex items-center justify-center gap-2"
        >
          View Results →
        </button>
      )}

      {/* Live view */}
      {phase !== 'idle' && (
        <LiveScraperView
          screenshot={screenshot}
          statusMessages={statusMessages}
          platformStatuses={platformStatuses}
          jobCount={jobCount}
          phase={phase}
        />
      )}
    </div>
  );
}

// ── Results tab ───────────────────────────────────────────────────────────────

function ResultsTab() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterMinScore, setFilterMinScore] = useState(0);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedSession !== 'all') params.sessionId = selectedSession;
      if (filterPlatform !== 'all') params.platform = filterPlatform;
      if (filterMinScore > 0) params.minScore = filterMinScore;
      const { data } = await api.get('/jobs', { params });
      setJobs(data);
    } catch {}
    setLoading(false);
  }, [selectedSession, filterPlatform, filterMinScore]);

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get('/jobs/sessions');
      setSessions(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/jobs/${id}`);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {}
  };

  const clearSession = async (sid) => {
    if (!sid || sid === 'all') return;
    if (!window.confirm('Clear all jobs from this session?')) return;
    try {
      await api.delete(`/jobs/sessions/${sid}`);
      setJobs([]);
      loadSessions();
    } catch {}
  };

  const deleteAll = async () => {
    if (!window.confirm(`Delete all ${jobs.length} job posts? This cannot be undone.`)) return;
    try {
      const params = {};
      if (selectedSession !== 'all') params.sessionId = selectedSession;
      if (filterPlatform !== 'all') params.platform = filterPlatform;
      await api.delete('/jobs', { params });
      setJobs([]);
      loadSessions();
    } catch {}
  };

  const platforms = [...new Set(jobs.map((j) => j.platform))];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs outline-none focus:border-brand"
            >
              <option value="all">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {new Date(s._max?.scrapedAt).toLocaleDateString()} ({s._count?.id} jobs)
                </option>
              ))}
            </select>
          </div>
          {selectedSession !== 'all' && (
            <button
              onClick={() => clearSession(selectedSession)}
              className="mt-4 p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Platform</label>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-xs outline-none focus:border-brand"
            >
              <option value="all">All Platforms</option>
              {platforms.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Min Score: {filterMinScore}</label>
            <input
              type="range" min="0" max="90" step="10"
              value={filterMinScore}
              onChange={(e) => setFilterMinScore(parseInt(e.target.value))}
              className="w-full accent-brand mt-1"
            />
          </div>
        </div>
      </div>

      {/* Stats + Delete All */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total', val: jobs.length, color: 'text-gray-700' },
              { label: 'High Match', val: jobs.filter((j) => (j.score ?? 0) >= 75).length, color: 'text-green-600' },
              { label: 'Avg Score', val: Math.round(jobs.reduce((s, j) => s + (j.score ?? 0), 0) / jobs.length), color: 'text-brand' },
            ].map((stat) => (
              <div key={stat.label} className="card p-3 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.val}</p>
                <p className="text-[10px] text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
          <button
            onClick={deleteAll}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete All {jobs.length} Posts
          </button>
        </div>
      )}

      {/* Job cards */}
      {loading ? (
        <div className="flex flex-col items-center py-10 gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <p className="text-sm font-bold text-gray-600">No jobs found</p>
          <p className="text-xs text-gray-400">Run a scrape from the Scraper tab to find jobs matching your profile.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab ?? 0);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const { socket } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/jobs/profile')
      .then(({ data }) => {
        setProfile(data);
        // Only default to Scraper tab if no tab was explicitly requested via navigation state
        if (data && location.state?.tab == null) setActiveTab(1);
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);  // eslint-disable-line

  // Listen for scrape completion to auto-switch to results
  useEffect(() => {
    if (!socket) return;
    const onComplete = () => setTimeout(() => setActiveTab(2), 1500);
    socket.on('scraper:complete', onComplete);
    return () => socket.off('scraper:complete', onComplete);
  }, [socket]);

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[#0A66C2] via-[#1A6BFF] to-[#0CAA41] px-5 pt-12 pb-8 overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white opacity-5" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white opacity-5" />
        <button onClick={() => navigate('/tools')} className="flex items-center gap-1.5 text-white/70 text-xs mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Tools
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">Job Finder</h1>
            <p className="text-white/70 text-xs">AI-powered · LinkedIn, Naukri, Indeed, Glassdoor</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mt-5">
        <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === i ? 'bg-white text-brand shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-5">
        {loadingProfile ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 0 && (
              <ProfileTab
                profile={profile}
                onSaved={(p) => { setProfile(p); setActiveTab(1); }}
                socket={socket}
              />
            )}
            {activeTab === 1 && <ScraperTab profile={profile} socket={socket} />}
            {activeTab === 2 && <ResultsTab />}
          </>
        )}
      </div>
    </div>
  );
}
