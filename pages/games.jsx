import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const games = [
  {
    name: 'Breakout',
    emoji: '🧱',
    description: 'Classic brick-breaking arcade game. Guide the paddle, bounce the ball, and smash every brick to win.',
    route: '/breakout',
    accent: '#6b9e4a',
    features: [
      'Arrow keys or mouse to control paddle',
      'Ball speeds up with each paddle hit',
      '6 rows of bricks to clear',
      '3 lives — don\'t let the ball drop!',
    ],
  },
  {
    name: 'Tetris',
    emoji: '🟦',
    description: 'The legendary block-stacking puzzle. Fit falling tetrominoes together and clear complete rows for points.',
    route: '/tetris',
    accent: '#4a7ab5',
    features: [
      '7 classic tetromino shapes',
      'Move, rotate, and hard-drop blocks',
      'Clear rows to score points',
      'Speed increases as you level up',
    ],
  },
  {
    name: 'Heads Up!',
    emoji: '📱',
    description: 'Hold the screen to your forehead and guess the words your friends shout! Swipe right for correct, left to skip.',
    route: '/heads-up',
    accent: '#b54a7a',
    features: [
      '8 categories with 240+ words',
      'Adjustable timer (15–60 seconds)',
      'Swipe or keyboard controls',
      'Score tracking and word review',
    ],
  },
  {
    name: 'Sky Fighter',
    emoji: '✈️',
    description: 'Top-down pixel airplane shooter. Drag to fly, auto-fire destroys enemy waves, collect random upgrades to grow stronger.',
    route: '/airplane-game',
    accent: '#3a86ff',
    features: [
      'Drag to move your plane',
      'Auto-fire destroys enemies',
      'Collect random power-up upgrades',
      'Wave-based difficulty scaling',
    ],
  },
  {
    name: 'Tank Battle',
    emoji: '🔥',
    description: 'Top-down tank combat on a procedurally-generated battlefield. Survive waves of enemies, destroy terrain, and collect power-ups.',
    route: '/tank',
    accent: '#e74c3c',
    features: [
      'WASD to move, mouse to aim & fire',
      '4 enemy types that scale with waves',
      'Destructible walls and rubble',
      'Power-up drops: health, speed, damage, special',
    ],
  },
  {
    name: 'Rube Goldberg',
    emoji: '⚙️',
    description: 'A Rube Goldberg chain-reaction machine! A ball rolls down the ramp, topples a domino, and lands in the basin. Verified by physics simulation — it works every time.',
    route: '/rube',
    accent: '#8e5ad8',
    features: [
      'Ball rolls down ramp & plows through a domino',
      'Balloon rises in a fan wind zone',
      'Goal basin catches the ball in a wide funnel',
      'Win condition: ball in basin + domino toppled',
    ],
  },
];

export default function Games() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Games 🎮</title>
      </Head>

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <a href="/" style={styles.backLink}>← News Digest</a>
          <h1 style={styles.pageTitle}>🎮 Arcade</h1>
          <span style={styles.hint}>Pick a game to start playing</span>
        </div>

        {/* Game cards */}
        <div style={styles.cardsGrid}>
          {games.map((game) => (
            <div
              key={game.name}
              style={{ ...styles.card, borderLeft: `4px solid ${game.accent}` }}
              onClick={() => router.push(game.route)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 12px 40px ${game.accent}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
              }}
            >
              {/* Emoji icon */}
              <div style={{ ...styles.cardIcon, background: `${game.accent}22` }}>
                <span style={{ fontSize: 56 }}>{game.emoji}</span>
              </div>

              <h2 style={styles.cardTitle}>{game.name}</h2>
              <p style={styles.cardDesc}>{game.description}</p>

              <ul style={styles.featureList}>
                {game.features.map((f, i) => (
                  <li key={i} style={styles.featureItem}>
                    <span style={{ color: game.accent, marginRight: 8 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                style={{ ...styles.playBtn, background: game.accent }}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(game.route);
                }}
              >
                ▶ Play {game.name}
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
    maxWidth: 900,
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
  cardsGrid: {
    maxWidth: 900,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 24,
    padding: '0 0 48px',
  },
  card: {
    background: '#1a2a1a',
    borderRadius: 16,
    padding: '28px 28px 24px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  cardIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 700,
    margin: '0 0 8px',
    color: '#ecfccb',
  },
  cardDesc: {
    fontSize: 15,
    color: '#a7c4a0',
    lineHeight: 1.6,
    margin: '0 0 20px',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px',
  },
  featureItem: {
    fontSize: 14,
    color: '#8a9e82',
    padding: '4px 0',
    display: 'flex',
    alignItems: 'center',
  },
  playBtn: {
    width: '100%',
    padding: '14px 0',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
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
