import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

function CronJobItem({ job, modelsData, getModelsForProvider, onUpdate }) {
  const [editProvider, setEditProvider] = useState(job.model_provider || '');
  const [editModel, setEditModel] = useState(job.model_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editProvider || !editModel) return;
    setSaving(true);
    await onUpdate(job.id, editProvider, editModel);
    setSaving(false);
  };

  const availableModels = editProvider ? getModelsForProvider(editProvider) : [];

  return (
    <div className="cron-item">
      <div className="cron-info">
        <h3>{job.name || 'Unnamed Job'}</h3>
        <p>Schedule: {job.schedule} · Last run: {job.last_run_status || 'unknown'}</p>
        <div className="job-model">
          <select value={editProvider} onChange={e => { setEditProvider(e.target.value); setEditModel(''); }} style={{maxWidth: '150px', fontSize: '0.85rem'}}>
            <option value="">Provider</option>
            {modelsData?.providers.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <select value={editModel} onChange={e => setEditModel(e.target.value)} disabled={!editProvider} style={{maxWidth: '200px', fontSize: '0.85rem'}}>
            <option value="">Model</option>
            {availableModels.map(m => (<option key={m} value={m}>{m}</option>))}
          </select>
          <button className="btn-outline" onClick={handleSave} disabled={saving || !editProvider || !editModel}>
            {saving ? 'Saving...' : 'Update'}
          </button>
        </div>
      </div>
      <span className={`cron-badge ${job.enabled !== false ? 'badge-active' : 'badge-paused'}`}>
        {job.enabled === false ? 'Paused' : 'Active'}
      </span>
    </div>
  );
}

export default function Admin() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [modelsData, setModelsData] = useState(null);
  const [newProvider, setNewProvider] = useState('');
  const [newModel, setNewModel] = useState('');
  const [applying, setApplying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [cronJobs, setCronJobs] = useState([]);
  const [showCronForm, setShowCronForm] = useState(false);
  const [cronForm, setCronForm] = useState({ name: '', schedule: '0 9 * * *', prompt: '', enabled_toolsets: '' });

  const [memoryEntries, setMemoryEntries] = useState([]);
  const [newMemEntry, setNewMemEntry] = useState('');
  const [memTarget, setMemTarget] = useState('user');

  const [gatewayStatus, setGatewayStatus] = useState(null);

  // Theme state
  const [theme, setTheme] = useState('dark');

  // Canvas + animation refs
  const canvasRef = useRef(null);
  const [hoveredIdx, setHoveredIdx] = useState(-1);

  // Animated gradient (hue rotation)
  const [hue, setHue] = useState(0);
  const animGrad = {
    gradient: `linear-gradient(135deg, hsl(${196 + hue}, 70%, 55%), hsl(${210 + hue}, 70%, 65%))`,
    accent1: `hsl(${196 + hue}, 70%, 55%)`,
  };

  useEffect(() => {
    Promise.allSettled([
      loadConfig(),
      loadCronJobs(),
      loadMemory(),
      loadModels(),
      loadGatewayStatus(),
    ]).finally(() => setLoading(false));
  }, []);

  const API_BASE = '/api';

  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/config/inference`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        setMessage({ type: 'warning', text: 'API server config endpoint not available. Use terminal commands to change settings.' });
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function loadCronJobs() {
    try {
      const res = await fetch(`${API_BASE}/cron/list`);
      if (res.ok) {
        const data = await res.json();
        setCronJobs(data.jobs || []);
      }
    } catch {}
  }

  async function loadMemory() {
    try {
      const res = await fetch(`${API_BASE}/memory/list`);
      if (res.ok) {
        const data = await res.json();
        setMemoryEntries(data.entries || []);
      }
    } catch {
      // Fallback: show empty state instead of stale hardcoded data
      setMemoryEntries([]);
    }
  }

  async function loadModels() {
    try {
      const res = await fetch(`${API_BASE}/models/list`);
      if (res.ok) {
        const data = await res.json();
        setModelsData(data);
      }
    } catch {}
  }

  async function loadGatewayStatus() {
    try {
      const res = await fetch(`${API_BASE}/gateway/status`);
      if (res.ok) {
        const data = await res.json();
        setGatewayStatus(data);
      }
    } catch {}
  }

  async function handleModelSwitch() {
    if (!newProvider || !newModel) return;
    setApplying(true);
    setMessage({ type: 'info', text: `Applying config change: ${newProvider} / ${newModel}...` });

    try {
      const res = await fetch(`${API_BASE}/config/inference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider, model: newModel }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `✅ Config updated successfully!\nProvider: ${newProvider}\nModel: ${newModel}\n\nGateway was restarted. Run 'hermes new' to start a session with the new config.` });
        setConfig({ provider: newProvider, model: newModel, base_url: data.base_url || '' });
        await loadModels();
      } else {
        setMessage({ type: 'warning', text: `⚠️ API update failed. Run manually:\nhermes config set model.provider ${newProvider}\nhermes config set model.default ${newModel}\nhermes gateway restart` });
      }
    } catch {}
    finally { setApplying(false); }
  }

  async function handleTestConnection() {
    if (!newProvider || !newModel) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/model/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider, model: newModel }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {}
    finally { setTesting(false); }
  }

  async function handleCronModelUpdate(jobId, provider, model) {
    try {
      const res = await fetch(`${API_BASE}/cron/job/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, provider, model }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `✅ Job ${jobId} model updated to ${provider}/${model}` });
        await loadCronJobs();
      } else {
        setMessage({ type: 'warning', text: `⚠️ ${data.message || 'Failed to update job model'}` });
      }
    } catch {}
  }

  function getModelsForProvider(providerId) {
    if (!modelsData?.known_models) return [];
    return modelsData.known_models[providerId] || [];
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'cron', label: '⏰ Cron Jobs' },
    { id: 'memory', label: '🧠 Memory' },
    { id: 'models', label: '🤖 Models' },
    { id: 'gateway', label: '🌐 Gateway' },
  ];

  const c = theme === 'dark'
    ? { bg: '#0a0e1a', cardBg: '#1a1a1a', border: '#333333', textPrimary: '#e0e0e0', textSecondary: '#a0a0a0', textMuted: '#8a8a8a' }
    : { bg: '#f5f5f5', cardBg: '#ffffff', border: '#d0d0d0', textPrimary: '#1a1a1a', textSecondary: '#555555', textMuted: '#888888' };

  const s = {
    page: { minHeight: '100vh', background: c.bg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", color: c.textPrimary, position: 'relative', overflowX: 'hidden' },
    canvasLayer: { position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' },

    content: { maxWidth: 960, margin: '0 auto', padding: '5rem 2rem', position: 'relative', zIndex: 1 },

    hero: { textAlign: 'center', marginBottom: '3.5rem', opacity: 0, animation: 'heroFadeIn 0.8s ease-out forwards' },
    title: { fontSize: 48, fontWeight: 700, margin: '0 0 12px', background: animGrad.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', transition: 'background 2s ease' },
    subtitle: { fontSize: 17, color: c.textSecondary, margin: '0 0 20px' },

    navGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: '3.5rem' },

    cardContainer: (i) => ({ position: 'relative', transformStyle: 'preserve-3d' }),
    card: (i, isHovered) => ({
      background: theme === 'dark' ? c.cardBg : '#ffffff', border: `1px solid ${c.border}`, borderRadius: 16, padding: i === 1 ? '28px' : '24px',
      position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s ease',
      transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
    }),
    cardGlow: (i) => ({
      position: 'absolute', inset: -1, borderRadius: 16, opacity: i === hoveredIdx ? 0.5 : 0, pointerEvents: 'none',
      background: `radial-gradient(ellipse at var(--mx, 50%) var(--my, 30%), rgba(134,196,118,0.12) 0%, transparent 70%)`, transition: 'opacity 0.3s ease', filter: 'blur(4px)',
    }),
    cardIcon: { fontSize: 36, marginBottom: 14 },
    cardTitle: { fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: c.textPrimary },
    cardDesc: { fontSize: 14, lineHeight: 1.65, color: c.textSecondary, margin: '0 0 20px' },

    cardBtn: (i) => ({
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10,
      background: i === hoveredIdx ? animGrad.gradient : 'rgba(134,196,118,0.08)',
      border: `1px solid ${i === hoveredIdx ? 'transparent' : c.border}`, color: c.textPrimary, fontSize: 15, fontWeight: 600, textDecoration: 'none', transition: 'all 0.3s ease', cursor: 'pointer',
    }),

    summaryBox: { background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '2rem', marginBottom: '3.5rem', position: 'relative', overflow: 'hidden' },
    shimmerLine: { position: 'absolute', top: 0, left: '-80px', width: '60px', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(134, 196, 118, 0.12), transparent)', animation: 'shimmerMove 3s ease-in-out infinite' },
    sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: animGrad.accent1, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, transition: 'color 2s ease' },
    labelBar: { width: 3, height: 16, borderRadius: 2, background: animGrad.gradient, transition: 'background 2s ease' },
    summaryText: { fontSize: 17, lineHeight: 1.85, color: c.textSecondary, margin: 0 },

    tagContainer: { marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' },
    tag: (i) => ({ padding: '6px 16px', borderRadius: 20, background: i === hoveredIdx ? 'rgba(134,196,118,0.1)' : 'rgba(134,196,118,0.05)', border: `1px solid rgba(134,196,118,${i === hoveredIdx ? 0.25 : 0.12})`, fontSize: 12, color: c.textSecondary }),

    footer: { marginTop: '3rem', paddingTop: '2rem', borderTop: `1px solid ${c.border}`, textAlign: 'center', fontSize: 13, color: c.textMuted },
    dotPulse: (d) => ({ width: 6, height: 6, borderRadius: '50%', animation: `dotPulse 2s ease-in-out ${d}s infinite` }),
  };

  // Admin tab styles
  const tabButtonStyle = (tab) => ({
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: activeTab === tab ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
    color: activeTab === tab ? '#60a5fa' : c.textSecondary,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: activeTab === tab ? 600 : 400,
    transition: 'all 0.2s',
  });

  const cardStyle = {
    background: c.cardBg,
    border: `1px solid ${c.border}`,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  };

  const labelStyle = { fontSize: 11, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 };
  const valueStyle = { fontSize: 14, color: c.textPrimary, fontWeight: 500 };

  return (
      <>
        <style>{`
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: #0a0a0a; border-radius: 4px; }
            ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #4a90d9, #6ba3ff); border-radius: 4px; }
            ::selection { background: rgba(134,196,118,0.3); color: #fff; }
            body { overflow-x: hidden; }
          `}</style>
        <div style={s.page}>
          <div style={{ ...s.content, maxWidth: 900, margin: '0 auto' }}>

            {/* Loading state */}
            {loading && (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>⚙️</div>
                <div style={{ fontSize: 14, color: c.textSecondary }}>Loading admin dashboard…</div>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div style={{ ...cardStyle, borderColor: '#f87171', background: 'rgba(248,113,113,0.1)', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#f87171', marginBottom: 12 }}>Failed to load admin dashboard</div>
                <button onClick={() => { loadConfig(); loadCronJobs(); loadMemory(); loadModels(); loadGatewayStatus(); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #f87171', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: 13 }}>🔄 Retry</button>
              </div>
            )}

            {/* Main content */}
            {!loading && !error && (
              <>
            {/* Header */}
            <header style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ ...s.title, fontSize: 24 }}>⚙️ Hermes Admin</h1>
                  <p style={{ ...s.subtitle, fontSize: 13 }}>Manage configuration, cron jobs, memory, and system status</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href="/" style={{ padding: '8px 16px', borderRadius: 12, border: `1px solid ${c.border}`, background: 'transparent', color: c.textSecondary, textDecoration: 'none', fontSize: 13, cursor: 'pointer' }}>← Back to Dashboard</a>
                  <button onClick={() => { loadConfig(); loadCronJobs(); loadMemory(); loadModels(); loadGatewayStatus(); }} style={{ padding: '8px 16px', borderRadius: 12, border: `1px solid ${c.border}`, background: 'transparent', color: c.textSecondary, cursor: 'pointer', fontSize: 13 }}>🔄 Refresh</button>
                </div>
              </div>
            </header>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabButtonStyle(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {activeTab === 'overview' && (
              <div>
                <div style={cardStyle}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>System Status</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Config</div>
                      <div style={valueStyle}>{config ? '✅ Loaded' : '❌ Not loaded'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Gateway</div>
                      <div style={{ ...valueStyle, color: gatewayStatus?.running ? '#4ade80' : '#f87171' }}>{gatewayStatus?.running ? '✅ Running' : '❌ Stopped'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Current Provider</div>
                      <div style={valueStyle}>{config?.provider || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Current Model</div>
                      <div style={valueStyle}>{config?.model || '—'}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Cron Jobs</div>
                      <div style={valueStyle}>{cronJobs.length} loaded</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Memory Entries</div>
                      <div style={valueStyle}>{memoryEntries.length} entries</div>
                    </div>
                  </div>
                </div>
                {message && (
                  <div style={{ ...cardStyle, borderColor: message.type === 'warning' ? '#f59e0b' : '#ef4444', background: message.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)' }}>
                    <span style={{ color: message.type === 'warning' ? '#f59e0b' : '#ef4444' }}>{message.text}</span>
                  </div>
                )}
              </div>
            )}

            {/* Cron Jobs tab */}
            {activeTab === 'cron' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Cron Jobs ({cronJobs.length})</h3>
                {cronJobs.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', color: c.textSecondary }}>No cron jobs found</div>}
                {cronJobs.map((job, i) => (
                  <div key={i} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: c.textPrimary }}>{job.name || job.id}</div>
                        <div style={{ fontSize: 11, color: c.textSecondary, fontFamily: 'monospace' }}>{job.id}</div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: job.enabled ? 'rgba(74,222,128,0.15)' : 'rgba(107,114,128,0.2)', color: job.enabled ? '#4ade80' : '#6b7280' }}>
                        {job.enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
                      <div>
                        <div style={labelStyle}>Schedule</div>
                        <div style={valueStyle}>{job.schedule || '—'}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>Provider</div>
                        <div style={valueStyle}>{job.model_provider || 'default'}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>Model</div>
                        <div style={valueStyle}>{job.model_name || 'default'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Memory tab */}
            {activeTab === 'memory' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Memory Entries ({memoryEntries.length})</h3>
                {memoryEntries.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', color: c.textSecondary }}>No memory entries</div>}
                {memoryEntries.map((entry, i) => (
                  <div key={i} style={cardStyle}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: entry.target === 'user' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: entry.target === 'user' ? '#a78bfa' : '#60a5fa' }}>
                        {entry.target}
                      </span>
                      <span style={{ fontSize: 13, color: c.textPrimary }}>{entry.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Models tab */}
            {activeTab === 'models' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Available Models</h3>
                {modelsData?.providers ? modelsData.providers.map((provider, i) => (
                  <div key={i} style={cardStyle}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: c.textPrimary, marginBottom: 8 }}>{provider.name}</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {provider.models.map((model, j) => (
                        <span key={j} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(255,255,255,0.05)', color: c.textSecondary, fontFamily: 'monospace' }}>
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>
                )) : <div style={{ ...cardStyle, textAlign: 'center', color: c.textSecondary }}>Loading models…</div>}
              </div>
            )}

            {/* Gateway tab */}
            {activeTab === 'gateway' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Gateway Status</h3>
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: gatewayStatus?.running ? '#4ade80' : '#f87171', boxShadow: gatewayStatus?.running ? '0 0 8px rgba(74,222,128,0.5)' : '0 0 8px rgba(248,113,113,0.5)' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: gatewayStatus?.running ? '#4ade80' : '#f87171' }}>
                      {gatewayStatus?.running ? 'Gateway Running' : 'Gateway Stopped'}
                    </span>
                  </div>
                  {gatewayStatus?.current_provider && (
                    <div style={{ fontSize: 12, marginBottom: 4 }}>
                      <span style={labelStyle}>Provider: </span>
                      <span style={valueStyle}>{gatewayStatus.current_provider}</span>
                    </div>
                  )}
                  {gatewayStatus?.current_model && (
                    <div style={{ fontSize: 12 }}>
                      <span style={labelStyle}>Model: </span>
                      <span style={valueStyle}>{gatewayStatus.current_model}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <footer style={{ textAlign: 'center', padding: '24px 0', color: c.textSecondary, fontSize: 12 }}>
              <p>Hermes Admin Dashboard · Powered by Hermes Agent</p>
            </footer>
              </>
            )}
          </div>
        </div>
      </>
      );
}
