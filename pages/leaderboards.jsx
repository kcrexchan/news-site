import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

/* =========================================================================== */
/*  Game definitions — one entry per leaderboard board.                        */
/*  Each board has a different score model, so we keep the unit + direction.   */
/* =========================================================================== */
const GAMES = [
  {
    id: 'blackjack',
    icon: '🃏',
    title: 'Blackjack',
    href: '/blackjack',
    unit: 'wallet',
    higherIsBetter: true,
    endpoint: '/api/blackjack/leaderboard',
    scoreKey: 'wallet',
    scoreLabel: 'Wallet',
    subKey: 'debt',
    subLabel: 'Debt',
    accent: '#e8c874',
    note: 'Ranked by bankroll (wallet).',
  },
  {
    id: 'tetris',
    icon: '🧱',
    title: 'Tetris',
    href: '/tetris',
    unit: 'score',
    higherIsBetter: true,
    endpoint: '/api/tetris/leaderboard',
    scoreKey: 'score',
    scoreLabel: 'Score',
    accent: '#7fdbca',
    note: 'Highest total score wins.',
  },
  {
    id: 'reaction',
    icon: '⚡',
    title: 'Reaction Time',
    href: '/reaction',
    unit: 'ms',
    higherIsBetter: false,
    endpoint: '/api/reaction/leaderboard',
    scoreKey: 'best',
    scoreLabel: 'Best (ms)',
    accent: '#8fd0ff',
    note: 'Fastest reaction time wins.',
  },
  {
    id: 'balloon',
    icon: '🎈',
    title: 'Balloon Pop',
    href: '/balloon',
    unit: 'pts',
    higherIsBetter: true,
    endpoint: '/api/balloon/leaderboard',
    scoreKey: 'best',
    scoreLabel: 'Best',
    accent: '#ff6b9d',
    note: 'Highest total balloon size wins.',
  },
];

/* =========================================================================== */
/*  Helpers                                                                    */
/* =========================================================================== */
function fmtScore(g, row) {
  const v = row[g.scoreKey];
  if (g.unit === 'wallet') {
    const n = Math.floor(Number(v) || 0);
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  if (g.unit === 'score') return (Math.floor(Number(v) || 0)).toLocaleString('en-US');
  if (g.unit === 'ms') return Math.floor(Number(v) || 0).toLocaleString('en-US') + ' ms';
  return String(v);
}

function fmtSub(g, row) {
  if (g.subKey) {
    const n = Math.max(0, Math.floor(Number(row[g.subKey]) || 0));
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  return '';
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/* =========================================================================== */
/*  Page                                                                       */
/* =========================================================================== */
export default function Leaderboards() {
  const [boards, setBoards] = useState({});   // id -> { scores, updated, error }
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  function load() {
    setLoading(true);
    Promise.all(GAMES.map((g) =>
      fetch(g.endpoint, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => ({ id: g.id, scores: data.scores || [], updated: data.updated, error: null }))
        .catch((err) => ({ id: g.id, scores: [], updated: null, error: err.message || 'failed' }))
    )).then((results) => {
      const next = {};
      results.forEach((r) => { next[r.id] = r; });
      setBoards(next);
      setLastRefresh(new Date().toISOString());
      setLoading(false);
    });
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const me = myName.trim().toLowerCase();

  // Per-game standing for the player (rank 1-based, or null if absent).
  const myStanding = useMemo(() => {
    const out = {};
    if (!me) return out;
    for (const g of GAMES) {
      const scores = (boards[g.id] && boards[g.id].scores) || [];
      const idx = scores.findIndex((r) => String(r.name || '').toLowerCase() === me);
      out[g.id] = idx >= 0 ? idx + 1 : null;
    }
    return out;
  }, [me, boards]);

  const v = {
    bg: 'var(--bg-primary)',
    cardBg: 'var(--bg-card)',
    border: 'var(--border-color)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
  };

  const isMe = (row) => me !== '' && String(row.name || '').toLowerCase() === me;

  return (
    <>
      <Head>
        <title>Leaderboards · Local LLM Hub</title>
        <meta name="description" content="All game leaderboards in one place — Blackjack, Tetris, Reaction Time." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: var(--bg-secondary); border-radius: 4px; }
          ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #4a90d9, #6ba3ff); border-radius: 4px; }
          ::selection { background: rgba(134,196,118,0.3); color: var(--text-primary); }
          body { overflow-x: hidden; }
          @keyframes lbIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          .lb-row-me { background: rgba(134,196,118,0.10) !important; box-shadow: inset 2px 0 0 #86c476; }
          .lb-row-me .lb-name { color: #7fdbca !important; font-weight: 800; }
          .lb-row-me .lb-name::after { content: '  (you)'; font-size: 10px; color: #86c476; font-weight: 700; }
        `}</style>
      </Head>

      <div style={{
        minHeight: '100vh', background: v.bg, color: v.textPrimary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        position: 'relative', overflowX: 'hidden',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '4rem 1.5rem 3rem', position: 'relative', zIndex: 1, opacity: 0, animation: 'lbIn 0.6s ease-out forwards' }}>

          {/* Header */}
          <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: 42, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              🏆 Leaderboards
            </h1>
            <p style={{ fontSize: 16, color: v.textSecondary, margin: '0 auto 1.75rem', maxWidth: 520, lineHeight: 1.6 }}>
              Every game, one place. Blackjack, Tetris and Reaction Time — your standing across the board.
            </p>

            {/* Name filter + refresh */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: v.cardBg, border: `1px solid ${v.border}`, fontSize: 13, color: v.textSecondary, fontWeight: 600 }}>
                <span style={{ opacity: 0.8 }}>Highlight</span>
                <input
                  type="text"
                  placeholder="your player name"
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: v.textPrimary, fontSize: 14, fontWeight: 600, width: 150, fontFamily: 'inherit' }}
                />
              </label>
              <button
                onClick={load}
                disabled={loading}
                style={{ padding: '10px 20px', borderRadius: 12, background: 'rgba(134,196,118,0.10)', border: '1px solid rgba(134,196,118,0.35)', color: v.textPrimary, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit' }}
              >
                {loading ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>

            {/* My standing strip */}
            {me && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
                {GAMES.map((g) => {
                  const rank = myStanding[g.id];
                  return (
                    <span key={g.id} style={{ padding: '6px 14px', borderRadius: 20, background: rank ? 'rgba(134,196,118,0.12)' : 'rgba(134,196,118,0.04)', border: `1px solid ${rank ? 'rgba(134,196,118,0.4)' : v.border}`, fontSize: 13, color: v.textSecondary, fontWeight: 600 }}>
                      {g.icon} {g.title}: {rank ? `#${rank}` : '—'}
                    </span>
                  );
                })}
              </div>
            )}
          </header>

          {/* Boards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22 }}>
            {GAMES.map((g) => {
              const b = boards[g.id];
              const scores = (b && b.scores) || [];
              return (
                <section key={g.id} style={{ background: v.cardBg, border: `1px solid ${v.border}`, borderRadius: 16, overflow: 'hidden', opacity: loading && !b ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                  {/* Card header */}
                  <div style={{ padding: '18px 20px', borderBottom: `1px solid ${v.border}`, background: `linear-gradient(135deg, ${g.accent}14, transparent)` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 26 }}>{g.icon}</span>
                        <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{g.title}</h2>
                      </div>
                      <a href={g.href} style={{ fontSize: 12, fontWeight: 700, color: g.accent, textDecoration: 'none', padding: '5px 12px', borderRadius: 8, border: `1px solid ${g.accent}55`, background: `${g.accent}12` }}>
                        Play →
                      </a>
                    </div>
                    <p style={{ fontSize: 12, color: v.textMuted, margin: 0 }}>{g.note}</p>
                  </div>

                  {/* Table */}
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ position: 'sticky', top: 0, background: v.cardBg, zIndex: 1 }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: v.textMuted, fontWeight: 700, borderBottom: `1px solid ${v.border}` }}>#</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: v.textMuted, fontWeight: 700, borderBottom: `1px solid ${v.border}` }}>Player</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: v.textMuted, fontWeight: 700, borderBottom: `1px solid ${v.border}` }}>{g.scoreLabel}</th>
                          {g.subKey && <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: v.textMuted, fontWeight: 700, borderBottom: `1px solid ${v.border}` }}>{g.subLabel}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {scores.length === 0 && (
                          <tr>
                            <td colSpan={g.subKey ? 4 : 3} style={{ padding: '26px 14px', textAlign: 'center', color: v.textMuted, fontSize: 13 }}>
                              {loading ? 'Loading…' : (b && b.error ? 'Board unavailable' : 'No scores yet — be the first!')}
                            </td>
                          </tr>
                        )}
                        {scores.map((row, i) => {
                          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
                          const meRow = isMe(row);
                          return (
                            <tr key={i} className={meRow ? 'lb-row-me' : ''} style={{ borderTop: `1px solid ${v.border}` }}>
                              <td style={{ padding: '11px 14px', fontSize: 13, color: v.textMuted, fontWeight: 700 }}>{medal}</td>
                              <td className="lb-name" style={{ padding: '11px 14px', fontWeight: 600, color: v.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{row.name}</td>
                              <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: g.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtScore(g, row)}</td>
                              {g.subKey && <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12, color: v.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fmtSub(g, row)}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Card footer */}
                  <div style={{ padding: '10px 20px', borderTop: `1px solid ${v.border}`, fontSize: 11, color: v.textMuted, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{scores.length} {scores.length === 1 ? 'entry' : 'entries'}</span>
                    {b && b.updated && <span>Updated {fmtTime(b.updated)}</span>}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Footer */}
          <footer style={{ marginTop: '3rem', paddingTop: '1.75rem', borderTop: `1px solid ${v.border}`, textAlign: 'center', fontSize: 13, color: v.textMuted }}>
            <p style={{ margin: 0 }}>
              Scores sync live from each game's leaderboard.{' '}
              {lastRefresh && <span style={{ opacity: 0.7 }}>· Refreshed {new Date(lastRefresh).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 12 }}>
              <a href="/" style={{ color: v.textSecondary, textDecoration: 'none', fontWeight: 600 }}>← Back to home</a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
