import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const games = [
  { name: 'Breakout', emoji: '🕹️', route: '/breakout', accent: '#6b9e4a' },
  { name: 'Tetris', emoji: '🟦', route: '/tetris', accent: '#4a7ab5' },
  { name: 'Air Hockey', emoji: '🏒', route: '/air-hockey', accent: '#38bdf8' },
  { name: 'Heads Up!', emoji: '📱', route: '/heads-up', accent: '#b54a7a' },
  { name: 'Sky Fighter', emoji: '✈️', route: '/airplane-game', accent: '#3a86ff' },
  { name: 'Tank Battle', emoji: '🛡️', route: '/tank', accent: '#e74c3c' },
  { name: 'Rube Goldberg', emoji: '⚙️', route: '/rube', accent: '#8e5ad8' },
  { name: 'Reaction Time', emoji: '⚡', route: '/reaction', accent: '#f5b301' },
  { name: 'Balloon Pop', emoji: '🎈', route: '/balloon', accent: '#ff6b9d' },
  { name: 'Tic-Tac-Toe', emoji: '❌⭕', route: '/tic-tac-toe', accent: '#35e08a' },
  { name: 'Memory Match', emoji: '🃏', route: '/memory-match', accent: '#e0c060' },
  { name: 'Sudoku', emoji: '🔢', route: '/sudoku', accent: '#6bdf4a' },
  { name: 'Blackjack', emoji: '🎰', route: '/blackjack-game', accent: '#d4af37' },
  { name: 'Slot Machine', emoji: '💰', route: '/slots-game', accent: '#c8a951' },
];

export default function Games() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Arcade · Local LLM Hub</title>
      </Head>

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <button onClick={() => router.back()} style={{...styles.backLink, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit'}}>← Back</button>
          <h1 style={styles.pageTitle}>🎮 Arcade</h1>
          <span style={styles.hint}>{games.length} games · pick one to play</span>
        </div>

        {/* Game grid — compact, no-scroll */}
        <div style={styles.grid}>
          {games.map((game) => (
            <div
              key={game.name}
              style={{ ...styles.card, borderLeft: `4px solid ${game.accent}` }}
              onClick={() => router.push(game.route)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 12px 36px ${game.accent}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
              }}
            >
              <div style={{ ...styles.cardIcon, background: `${game.accent}22` }}>
                <span style={{ fontSize: 48 }}>{game.emoji}</span>
              </div>
              <h2 style={styles.cardTitle}>{game.name}</h2>
              <button
                style={{ ...styles.playBtn, background: game.accent }}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(game.route);
                }}
              >
                ▶ Play
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          Built with Canvas API · Mobile touch controls supported
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1a0f',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    color: '#ecfccb',
    padding: '0 20px',
  },
  header: {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '32px 0 24px',
    textAlign: 'center',
  },
  backLink: {
    color: '#a7c4a0',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
    display: 'inline-block',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 42,
    fontWeight: 800,
    margin: '0 0 8px',
    color: '#ecfccb',
  },
  hint: {
    fontSize: 16,
    color: '#7a8f6e',
  },
  grid: {
    maxWidth: 1080,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 20,
    paddingBottom: 40,
  },
  card: {
    background: '#1a2a1a',
    borderRadius: 16,
    padding: '28px 20px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  cardIcon: {
    width: 76,
    height: 76,
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 18px',
    color: '#ecfccb',
  },
  playBtn: {
    width: '100%',
    padding: '12px 0',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.5px',
  },
  footer: {
    textAlign: 'center',
    color: '#3d5a2e',
    fontSize: 13,
    paddingBottom: 40,
  },
};
