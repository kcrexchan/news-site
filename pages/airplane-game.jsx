import React, { useRef, useEffect, useState } from 'react'
import Head from 'next/head'

// ─── Power-up types (instant apply on pickup) ───────────────────
const POWER_UP_TYPES = [
  { id: 'fireRate', name: 'Rapid Fire', icon: '⚡', color: '#f5b041', apply: (gs) => { gs.upgrades.fireRate = Math.max(60, gs.upgrades.fireRate * 0.7) } },
  { id: 'spread', name: 'Spread Shot', icon: '🔱', color: '#7fdbca', apply: (gs) => { gs.upgrades.bulletSpread = Math.min(5, gs.upgrades.bulletSpread + 1) } },
  { id: 'damage', name: 'Heavy Rounds', icon: '💥', color: '#e67e22', apply: (gs) => { gs.upgrades.bulletDamage += 1 } },
  { id: 'shield', name: 'Shield', icon: '🛡️', color: '#7fdbca', apply: (gs) => { gs.upgrades.shield = true; setTimeout(() => { gs.upgrades.shield = false }, 8000) } },
  { id: 'speed', name: 'Afterburner', icon: '🚀', color: '#3a86ff', apply: (gs) => { gs.upgrades.speedMultiplier *= 1.2 } },
  { id: 'heal', name: 'Repair', icon: '❤️', color: '#e63946', apply: (gs) => { gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 30) } },
  { id: 'score', name: 'Bonus Points', icon: '💰', color: '#f5b041', apply: (gs) => { gs.upgrades.scoreMultiplier += 0.5 } },
  { id: 'missile', name: 'Seeking Missiles', icon: '🎯', color: '#ff6b6b', apply: (gs) => {
    for (let i = 0; i < 3; i++) {
      gs.missiles.push({
        x: gs.player.x + (i - 1) * 15,
        y: gs.player.y - 10,
        vx: (i - 1) * 1, vy: -3,
        speed: 5, damage: 3, lifetime: 300,
      })
    }
  }},
]

// ─── Boss definitions (5 levels, each unique) ──────────────────
const BOSSES = [
  {
    name: 'IRON BULWARK',
    level: 1,
    hp: 80,
    color: '#6b7b8d',
    accentColor: '#8d9bb5',
    speed: 0.8,
    drift: 1.5,
    attackPattern: 'burst',
    attackInterval: 90,
    bulletSpeed: 3,
    bulletCount: 5,
    defense: 'armor',
    intro: 'A massive armored dreadnought blocks your path!',
  },
  {
    name: 'STORM DANCER',
    level: 2,
    hp: 60,
    color: '#1a8a6a',
    accentColor: '#3ae8b0',
    speed: 2.5,
    drift: 4,
    attackPattern: 'spread',
    attackInterval: 60,
    bulletSpeed: 4,
    bulletCount: 3,
    defense: 'dodge',
    intro: 'A lightning-fast interceptor weaves through the sky!',
  },
  {
    name: 'SWARM QUEEN',
    level: 3,
    hp: 70,
    color: '#7b2d8e',
    accentColor: '#c77dff',
    speed: 1.2,
    drift: 2,
    attackPattern: 'spawn',
    attackInterval: 120,
    bulletSpeed: 2.5,
    bulletCount: 2,
    defense: 'minions',
    intro: 'A massive bio-mechanical queen descends with her swarm!',
  },
  {
    name: 'SNIPER PHANTOM',
    level: 4,
    hp: 50,
    color: '#4a1a2e',
    accentColor: '#ff3366',
    speed: 3,
    drift: 3,
    attackPattern: 'aimed',
    attackInterval: 45,
    bulletSpeed: 6,
    bulletCount: 1,
    defense: 'phase',
    intro: 'A ghostly phantom appears and vanishes — targeting you!',
  },
  {
    name: 'VOID EMPEROR',
    level: 5,
    hp: 120,
    color: '#2a0a3e',
    accentColor: '#ff00ff',
    speed: 1.5,
    drift: 2.5,
    attackPattern: 'chaos',
    attackInterval: 30,
    bulletSpeed: 5,
    bulletCount: 8,
    defense: 'regen',
    intro: 'THE VOID EMPEROR — ruler of the endless abyss!',
  },
]

// ─── Level configs ──────────────────────────────────────────────
const LEVELS = [
  { enemiesToDefeat: 14, spawnInterval: 1500, enemySpeed: 1.5, enemyHp: 1, powerUpChance: 0.45 },
  { enemiesToDefeat: 19, spawnInterval: 1300, enemySpeed: 2.0, enemyHp: 2, powerUpChance: 0.42 },
  { enemiesToDefeat: 24, spawnInterval: 1100, enemySpeed: 2.2, enemyHp: 2, powerUpChance: 0.40 },
  { enemiesToDefeat: 30, spawnInterval: 900, enemySpeed: 2.5, enemyHp: 3, powerUpChance: 0.38 },
  { enemiesToDefeat: 36, spawnInterval: 750, enemySpeed: 2.8, enemyHp: 3, powerUpChance: 0.35 },
]

const ENEMY_COLORS = ['#c0552d', '#d4432e', '#a62525', '#e67e22', '#8b0000']

// ─── Web Audio sound engine (synthesized, no audio files) ───────
let _actx = null
let _amaster = null
function _ensureAudio() {
  if (_actx) return _actx
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  _actx = new AC()
  _amaster = _actx.createGain()
  _amaster.gain.value = 0.35
  _amaster.connect(_actx.destination)
  return _actx
}
function initAudio() {
  const c = _ensureAudio()
  if (c && c.state === 'suspended') c.resume()
  return !!c
}
// one-shot oscillator tone with exponential decay envelope
function _tone(freq, dur, opts = {}) {
  const c = _ensureAudio()
  if (!c) return
  const { type = 'sine', vol = 0.3, delay = 0, freqEnd = null } = opts
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(_amaster)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}
// white-noise burst for explosions / impacts
function _noise(dur, opts = {}) {
  const c = _ensureAudio()
  if (!c) return
  const { vol = 0.4, delay = 0, lowpass = 1200 } = opts
  const t0 = c.currentTime + delay
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  const filt = c.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = lowpass
  src.connect(filt)
  filt.connect(g)
  g.connect(_amaster)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}
const sfx = {
  shoot()        { _tone(880, 0.06, { type: 'square', vol: 0.06, freqEnd: 520 }) },
  hitEnemy()     { _tone(300, 0.07, { type: 'triangle', vol: 0.14, freqEnd: 160 }) },
  explosion()    { _noise(0.35, { vol: 0.45, lowpass: 1600 }); _tone(120, 0.3, { type: 'sawtooth', vol: 0.18, freqEnd: 40 }) },
  bossExplosion(){ _noise(0.7, { vol: 0.6, lowpass: 2200 }); _tone(90, 0.6, { type: 'sawtooth', vol: 0.28, freqEnd: 30 }) },
  playerHit()    { _tone(180, 0.16, { type: 'square', vol: 0.22, freqEnd: 70 }); _noise(0.12, { vol: 0.15, lowpass: 900 }) },
  shieldHit()    { _tone(520, 0.12, { type: 'sine', vol: 0.18, freqEnd: 720 }) },
  powerup()      { [523, 659, 784, 1047].forEach((f, i) => _tone(f, 0.1, { type: 'triangle', vol: 0.18, delay: i * 0.06 })) },
  levelUp()      { [392, 523, 659, 784, 1047].forEach((f, i) => _tone(f, 0.14, { type: 'sine', vol: 0.2, delay: i * 0.08 })) },
  bossWarn()     { [110, 98, 87].forEach((f, i) => _tone(f, 0.3, { type: 'sawtooth', vol: 0.22, delay: i * 0.22, freqEnd: f * 0.85 })) },
  gameOver()     { [440, 349, 294, 220].forEach((f, i) => _tone(f, 0.28, { type: 'triangle', vol: 0.22, delay: i * 0.18, freqEnd: f * 0.9 })) },
  victory()      { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => _tone(f, 0.22, { type: 'sine', vol: 0.22, delay: i * 0.1 })) },
}

// ─── Chiptune background music (looping 8-bar pattern, scheduled ahead of time) ───
// Am – F – C – G progression (2 bars each), bass + arp + kick + hi-hat.
const _MUSIC = {
  step: 0,
  nextTime: 0,
  timer: null,
  playing: false,
  master: null,
}
const _MIDI = { A2: 45, F2: 41, C2: 36, G2: 43 }
// 4-chord progression (Am – F – C – G), one chord per 4/4 bar (8 eighth-note steps).
const _PROG = [
  { bass: 45, arp: [57, 60, 64, 69] },  // Am
  { bass: 41, arp: [53, 57, 60, 65] },  // F
  { bass: 36, arp: [48, 52, 55, 60] },  // C
  { bass: 43, arp: [55, 59, 62, 67] },  // G
]
const _LOOP_STEPS = _PROG.length * 8 // 32
function _midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12) }
function _scheduleMusicStep(step, t0) {
  if (!_MUSIC.master) return
  const c = _actx
  const bar = Math.floor(step / 8) % _PROG.length
  const stepInBar = step % 8
  const chord = _PROG[bar]
  // Bass — pumping root + fifth on a driving 8th-note rhythm
  if ([0, 3, 4, 7].includes(stepInBar)) {
    const note = (stepInBar === 3) ? chord.bass + 7 : chord.bass
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'triangle'
    osc.frequency.value = _midiToHz(note)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
    osc.connect(g); g.connect(_MUSIC.master)
    osc.start(t0); osc.stop(t0 + 0.22)
  }
  // Arp — one chord tone per 8th note, cycling up the chord
  const a = chord.arp[stepInBar % chord.arp.length] + 12 // one octave up
  const oscA = c.createOscillator()
  const gA = c.createGain()
  oscA.type = 'square'
  oscA.frequency.value = _midiToHz(a)
  gA.gain.setValueAtTime(0.0001, t0)
  gA.gain.exponentialRampToValueAtTime(0.045, t0 + 0.01)
  gA.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12)
  oscA.connect(gA); gA.connect(_MUSIC.master)
  oscA.start(t0); oscA.stop(t0 + 0.14)
  // Kick — beats 1 and 3 (steps 0 and 4 of the bar)
  if (stepInBar === 0 || stepInBar === 4) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, t0)
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.12)
    g.gain.setValueAtTime(0.32, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15)
    osc.connect(g); g.connect(_MUSIC.master)
    osc.start(t0); osc.stop(t0 + 0.16)
  }
  // Hi-hat — on the off-beats (steps 2 and 6)
  if (stepInBar === 2 || stepInBar === 6) {
    const len = Math.max(1, Math.floor(c.sampleRate * 0.04))
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    g.gain.value = 0.05
    const filt = c.createBiquadFilter()
    filt.type = 'highpass'
    filt.frequency.value = 6000
    src.connect(filt); filt.connect(g); g.connect(_MUSIC.master)
    src.start(t0)
  }
}
function startMusic() {
  const c = _ensureAudio()
  if (!c) return
  if (c.state === 'suspended') c.resume()
  if (_MUSIC.playing) return
  _MUSIC.playing = true
  _MUSIC.step = 0
  if (!_MUSIC.master) {
    _MUSIC.master = c.createGain()
    _MUSIC.master.gain.value = 0.5
    _MUSIC.master.connect(_amaster)
  }
  const stepDur = 60 / (_MUSIC.bpm || 132) / 2 // 8th notes
  _MUSIC.nextTime = c.currentTime + 0.05
  _MUSIC.timer = setInterval(() => {
    while (_MUSIC.nextTime < c.currentTime + 0.12) {
      _scheduleMusicStep(_MUSIC.step, _MUSIC.nextTime)
      _MUSIC.step = (_MUSIC.step + 1) % 32
      _MUSIC.nextTime += stepDur
    }
  }, 30)
}
function setMusicTempo(level) {
  // Faster, denser music as levels ramp up (132 → 176 BPM by level 5)
  _MUSIC.bpm = 132 + (level - 1) * 11
  if (_MUSIC.playing) {
    stopMusic()
    startMusic()
  }
}
function stopMusic() {
  if (!_MUSIC.playing) return
  _MUSIC.playing = false
  if (_MUSIC.timer) { clearInterval(_MUSIC.timer); _MUSIC.timer = null }
}

// ─── Background themes per level ────────────────────────────────
const BG_THEMES = [
  { top: '#0a1628', mid: '#0d1f3c', bot: '#162d50', stars: 80 },      // Level 1: deep blue night
  { top: '#061220', mid: '#0a2030', bot: '#0d2840', stars: 60 },      // Level 2: storm teal
  { top: '#0e0618', mid: '#1a0a30', bot: '#200e40', stars: 70 },      // Level 3: purple haze
  { top: '#0a0610', mid: '#150a18', bot: '#1a0e20', stars: 50 },      // Level 4: dark crimson
  { top: '#060010', mid: '#0a0020', bot: '#0e0030', stars: 40 },      // Level 5: void
]

// ─── Realistic Drawing Functions ────────────────────────────────

function drawBackground(ctx, W, H, timestamp, level) {
  const theme = BG_THEMES[(level - 1) % BG_THEMES.length]

  // ── Base gradient ──
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, theme.top)
  grad.addColorStop(0.5, theme.mid)
  grad.addColorStop(1, theme.bot)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // ── Twinkling stars (all levels) ──
  for (let i = 0; i < theme.stars; i++) {
    const x = ((42 * (i + 1) * 7) % W)
    const y = ((timestamp * 0.01 + i * 37) % (H + 20)) - 10
    const brightness = 0.08 + (Math.sin(timestamp * 0.003 + i) * 0.5 + 0.5) * 0.25
    ctx.fillStyle = `rgba(200, 220, 255, ${brightness})`
    ctx.beginPath()
    ctx.arc(x, y, 0.5 + Math.random() * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── Forward-flight speed streaks (all levels) ──
  // Vertical wind lines rushing top→bottom to sell "the plane is flying forward"
  const streakCount = 26
  for (let s = 0; s < streakCount; s++) {
    const seedA = 97 * (s + 1)
    const seedB = 61 * (s + 1)
    const sx = (seedA * 1.7) % W
    // Each streak scrolls down at a slightly different speed (depth illusion)
    const speed = 0.14 + (s % 5) * 0.03
    const len = 30 + (s % 6) * 18
    const sy = ((timestamp * speed + seedB * 3.3) % (H + len * 2)) - len
    const alpha = 0.05 + (s % 4) * 0.02
    ctx.strokeStyle = `rgba(190, 215, 255, ${alpha})`
    ctx.lineWidth = 1 + (s % 3) * 0.5
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx, sy + len)
    ctx.stroke()
  }

  // ── Level-specific animated elements ──
  switch (level) {
    case 1: drawLevel1Background(ctx, W, H, timestamp); break
    case 2: drawLevel2Background(ctx, W, H, timestamp); break
    case 3: drawLevel3Background(ctx, W, H, timestamp); break
    case 4: drawLevel4Background(ctx, W, H, timestamp); break
    case 5: drawLevel5Background(ctx, W, H, timestamp); break
  }
}

// ─── Level 1: Deep Blue Night — clouds, distant terrain, aurora shimmer ───
function drawLevel1Background(ctx, W, H, timestamp) {
  // Aurora borealis shimmer at top
  for (let i = 0; i < 3; i++) {
    const auroraY = 30 + i * 25
    const auroraAlpha = 0.03 + Math.sin(timestamp * 0.001 + i * 2) * 0.02
    ctx.strokeStyle = `rgba(100, 200, 150, ${auroraAlpha})`
    ctx.lineWidth = 20 + Math.sin(timestamp * 0.002 + i) * 8
    ctx.beginPath()
    for (let x = 0; x < W; x += 4) {
      const y = auroraY + Math.sin(x * 0.015 + timestamp * 0.0008 + i) * 15
      + Math.sin(x * 0.008 + timestamp * 0.0012) * 10
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Scrolling clouds — drift DOWNWARD to sell forward flight
  for (let c = 0; c < 5; c++) {
    const cx = (c * 120 + 40) % (W + 160)
    const cy = ((timestamp * (0.06 + c * 0.012) + c * 90) % (H + 120)) - 60
    const cloudAlpha = 0.05 + Math.sin(timestamp * 0.002 + c) * 0.02
    ctx.fillStyle = `rgba(180, 200, 230, ${cloudAlpha})`
    ctx.beginPath()
    ctx.ellipse(cx, cy, 60 + c * 5, 14 + Math.sin(c) * 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + 30, cy - 6, 35, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx - 25, cy + 4, 40, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Distant mountain silhouette at bottom
  ctx.fillStyle = 'rgba(15, 25, 45, 0.6)'
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += 8) {
    const mountainY = H - 30
    - Math.sin(x * 0.008) * 20
    - Math.sin(x * 0.015 + 1) * 12
    - Math.sin(x * 0.003) * 15
    ctx.lineTo(x, mountainY)
  }
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  // Moon glow
  const moonX = W * 0.75
  const moonY = 60
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 5, moonX, moonY, 50)
  moonGlow.addColorStop(0, 'rgba(200, 220, 255, 0.12)')
  moonGlow.addColorStop(0.5, 'rgba(150, 180, 220, 0.04)')
  moonGlow.addColorStop(1, 'rgba(100, 140, 200, 0)')
  ctx.fillStyle = moonGlow
  ctx.beginPath()
  ctx.arc(moonX, moonY, 50, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(220, 230, 250, 0.25)'
  ctx.beginPath()
  ctx.arc(moonX, moonY, 8, 0, Math.PI * 2)
  ctx.fill()
}

// ─── Level 2: Storm Teal — lightning flashes, rain streaks, storm clouds ───
function drawLevel2Background(ctx, W, H, timestamp) {
  // Dark storm clouds at top
  for (let c = 0; c < 4; c++) {
    const cx = ((timestamp * 0.008 + c * 150) % (W + 200)) - 100
    const cy = 40 + c * 30
    ctx.fillStyle = `rgba(20, 50, 70, ${0.2 + Math.sin(timestamp * 0.001 + c) * 0.08})`
    ctx.beginPath()
    ctx.ellipse(cx, cy, 90 + c * 10, 20, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + 40, cy - 8, 55, 15, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Rain streaks
  ctx.strokeStyle = 'rgba(120, 180, 210, 0.15)'
  ctx.lineWidth = 1
  for (let r = 0; r < 40; r++) {
    const rx = ((r * 37 + timestamp * 0.05) % (W + 20)) - 10
    const ry = ((r * 53 + timestamp * 0.15) % (H + 40)) - 20
    const rainLen = 12 + Math.sin(r * 2.3) * 5
    ctx.beginPath()
    ctx.moveTo(rx, ry)
    ctx.lineTo(rx - 2, ry + rainLen)
    ctx.stroke()
  }

  // Lightning flash (occasional)
  const flashCycle = timestamp % 4000
  if (flashCycle < 80) {
    const flashAlpha = (1 - flashCycle / 80) * 0.15
    ctx.fillStyle = `rgba(180, 220, 255, ${flashAlpha})`
    ctx.fillRect(0, 0, W, H)

    // Lightning bolt
    if (flashCycle < 40) {
      const boltAlpha = (1 - flashCycle / 40) * 0.6
      ctx.strokeStyle = `rgba(200, 230, 255, ${boltAlpha})`
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(150, 200, 255, 0.8)'
      ctx.shadowBlur = 15
      ctx.beginPath()
      let bx = W * 0.3 + Math.sin(timestamp * 0.01) * 50
      let by = 0
      ctx.moveTo(bx, by)
      for (let s = 0; s < 8; s++) {
        bx += (Math.random() - 0.5) * 40
        by += H / 10
        ctx.lineTo(bx, by)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }

  // Fog layer at bottom
  for (let f = 0; f < 3; f++) {
    const fogY = H - 40 - f * 20
    const fogAlpha = 0.03 + Math.sin(timestamp * 0.0008 + f * 2) * 0.015
    ctx.fillStyle = `rgba(40, 80, 100, ${fogAlpha})`
    ctx.fillRect(0, fogY, W, 30)
  }
}

// ─── Level 3: Purple Haze — floating spores, organic mist, bioluminescence ───
function drawLevel3Background(ctx, W, H, timestamp) {
  // Organic mist layers
  for (let m = 0; m < 4; m++) {
    const mistY = 80 + m * 120
    const mistAlpha = 0.025 + Math.sin(timestamp * 0.0006 + m * 1.5) * 0.015
    const mistGrad = ctx.createRadialGradient(
      W / 2 + Math.sin(timestamp * 0.0004 + m) * 80, mistY, 10,
      W / 2, mistY, 150
    )
    mistGrad.addColorStop(0, `rgba(120, 40, 160, ${mistAlpha})`)
    mistGrad.addColorStop(1, 'rgba(80, 20, 120, 0)')
    ctx.fillStyle = mistGrad
    ctx.beginPath()
    ctx.arc(W / 2 + Math.sin(timestamp * 0.0004 + m) * 80, mistY, 150, 0, Math.PI * 2)
    ctx.fill()
  }

  // Bioluminescent spores
  for (let s = 0; s < 15; s++) {
    const sx = W * 0.1 + Math.sin(timestamp * 0.0005 + s * 3.7) * W * 0.4 + s * 20
    const sy = (timestamp * 0.02 + s * 80) % H
    const sporePulse = 0.15 + Math.sin(timestamp * 0.004 + s * 2) * 0.1
    const sporeSize = 2 + Math.sin(timestamp * 0.003 + s) * 1
    const sporeGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sporeSize * 4)
    sporeGlow.addColorStop(0, `rgba(199, 125, 255, ${sporePulse})`)
    sporeGlow.addColorStop(1, 'rgba(120, 60, 180, 0)')
    ctx.fillStyle = sporeGlow
    ctx.beginPath()
    ctx.arc(sx, sy, sporeSize * 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(220, 180, 255, ${sporePulse * 1.5})`
    ctx.beginPath()
    ctx.arc(sx, sy, sporeSize, 0, Math.PI * 2)
    ctx.fill()
  }

  // Tentacle-like vines from edges
  for (let v = 0; v < 3; v++) {
    const side = v < 2 ? (v === 0 ? 0 : W) : 0
    const vineY = 100 + v * 150
    ctx.strokeStyle = `rgba(100, 30, 140, ${0.08 + Math.sin(timestamp * 0.001 + v) * 0.04})`
    ctx.lineWidth = 2
    ctx.beginPath()
    let vx = side
    let vy = vineY
    ctx.moveTo(vx, vy)
    for (let segment = 0; segment < 6; segment++) {
      vx += (side === 0 ? 1 : -1) * (15 + Math.sin(timestamp * 0.002 + segment + v) * 8)
      vy += 20
      ctx.lineTo(vx, vy)
    }
    ctx.stroke()
  }

  // Pulsing ground glow
  const groundPulse = 0.03 + Math.sin(timestamp * 0.001) * 0.015
  const groundGrad = ctx.createLinearGradient(0, H - 60, 0, H)
  groundGrad.addColorStop(0, 'rgba(60, 20, 80, 0)')
  groundGrad.addColorStop(1, `rgba(80, 30, 110, ${groundPulse})`)
  ctx.fillStyle = groundGrad
  ctx.fillRect(0, H - 60, W, 60)
}

// ─── Level 4: Dark Crimson — radar sweeps, targeting grids, red alert pulse ───
function drawLevel4Background(ctx, W, H, timestamp) {
  // Grid overlay (subtle)
  ctx.strokeStyle = 'rgba(120, 30, 50, 0.06)'
  ctx.lineWidth = 0.5
  const gridSize = 40
  const gridOffsetX = (timestamp * 0.01) % gridSize
  const gridOffsetY = (timestamp * 0.005) % gridSize
  for (let gx = -gridSize + gridOffsetX; gx < W + gridSize; gx += gridSize) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, H)
    ctx.stroke()
  }
  for (let gy = -gridSize + gridOffsetY; gy < H + gridSize; gy += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(W, gy)
    ctx.stroke()
  }

  // Radar sweep from center
  const radarAngle = (timestamp * 0.001) % (Math.PI * 2)
  const radarCenterX = W / 2
  const radarCenterY = H / 2
  const radarRadius = Math.max(W, H) * 0.7
  for (let ring = 1; ring <= 3; ring++) {
    const ringR = (radarRadius / 3) * ring
    ctx.strokeStyle = `rgba(180, 40, 60, ${0.04 + Math.sin(timestamp * 0.002) * 0.02})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.arc(radarCenterX, radarCenterY, ringR, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Sweep line
  ctx.strokeStyle = 'rgba(200, 50, 70, 0.12)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(radarCenterX, radarCenterY)
  ctx.lineTo(
    radarCenterX + Math.cos(radarAngle) * radarRadius,
    radarCenterY + Math.sin(radarAngle) * radarRadius
  )
  ctx.stroke()
  // Sweep wedge
  const sweepGrad = ctx.createConicGradient(radarAngle - 0.3, radarCenterX, radarCenterY)
  sweepGrad.addColorStop(0, 'rgba(200, 50, 70, 0)')
  sweepGrad.addColorStop(0.1, 'rgba(200, 50, 70, 0.03)')
  sweepGrad.addColorStop(0.2, 'rgba(200, 50, 70, 0)')
  sweepGrad.addColorStop(1, 'rgba(200, 50, 70, 0)')
  ctx.fillStyle = sweepGrad
  ctx.beginPath()
  ctx.arc(radarCenterX, radarCenterY, radarRadius, 0, Math.PI * 2)
  ctx.fill()

  // Red alert pulse (screen edge glow)
  const alertPulse = 0.04 + Math.sin(timestamp * 0.003) * 0.025
  const edgeGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7)
  edgeGrad.addColorStop(0, 'rgba(150, 30, 50, 0)')
  edgeGrad.addColorStop(1, `rgba(150, 30, 50, ${alertPulse})`)
  ctx.fillStyle = edgeGrad
  ctx.fillRect(0, 0, W, H)

  // Scanning data lines
  for (let d = 0; d < 5; d++) {
    const dy = ((timestamp * 0.03 + d * 100) % (H + 20)) - 10
    ctx.fillStyle = `rgba(180, 40, 60, ${0.02 + Math.sin(timestamp * 0.005 + d) * 0.01})`
    ctx.fillRect(0, dy, W, 1)
  }

  // Targeting crosshairs (flickering)
  if (Math.sin(timestamp * 0.005) > 0.3) {
    const crossAlpha = 0.06 + Math.sin(timestamp * 0.008) * 0.03
    const crossSize = 15
    for (let cx = 0; cx < 3; cx++) {
      const chx = W * 0.2 + cx * W * 0.3 + Math.sin(timestamp * 0.001 + cx) * 20
      const chy = H * 0.3 + Math.cos(timestamp * 0.0015 + cx * 2) * 40
      ctx.strokeStyle = `rgba(200, 50, 70, ${crossAlpha})`
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(chx - crossSize, chy)
      ctx.lineTo(chx - crossSize / 3, chy)
      ctx.moveTo(chx + crossSize / 3, chy)
      ctx.lineTo(chx + crossSize, chy)
      ctx.moveTo(chx, chy - crossSize)
      ctx.lineTo(chx, chy - crossSize / 3)
      ctx.moveTo(chx, chy + crossSize / 3)
      ctx.lineTo(chx, chy + crossSize)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(chx, chy, crossSize, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

// ─── Level 5: Void — cosmic nebula, distortion rings, particle vortex ───
function drawLevel5Background(ctx, W, H, timestamp) {
  // Cosmic nebula clouds
  for (let n = 0; n < 4; n++) {
    const nebX = W * (0.2 + n * 0.2) + Math.sin(timestamp * 0.0003 + n * 2) * 40
    const nebY = H * (0.3 + Math.sin(n * 1.5) * 0.2) + Math.cos(timestamp * 0.0004 + n) * 30
    const nebGrad = ctx.createRadialGradient(nebX, nebY, 5, nebX, nebY, 100 + n * 15)
    const hue = 280 + n * 20 + Math.sin(timestamp * 0.0005) * 10
    nebGrad.addColorStop(0, `hsla(${hue}, 60%, 20%, 0.06)`)
    nebGrad.addColorStop(0.5, `hsla(${hue + 20}, 50%, 15%, 0.03)`)
    nebGrad.addColorStop(1, `hsla(${hue}, 40%, 10%, 0)`)
    ctx.fillStyle = nebGrad
    ctx.beginPath()
    ctx.arc(nebX, nebY, 100 + n * 15, 0, Math.PI * 2)
    ctx.fill()
  }

  // Distortion rings (concentric, pulsing)
  const ringCenterX = W / 2
  const ringCenterY = H / 2
  for (let r = 0; r < 5; r++) {
    const ringR = 40 + r * 30 + Math.sin(timestamp * 0.002 + r * 0.8) * 10
    const ringAlpha = 0.04 + Math.sin(timestamp * 0.0015 + r) * 0.02
    ctx.strokeStyle = `rgba(200, 0, 255, ${ringAlpha})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(ringCenterX, ringCenterY, ringR, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Particle vortex (spiraling inward)
  for (let v = 0; v < 20; v++) {
    const baseAngle = (v / 20) * Math.PI * 2
    const spiralSpeed = timestamp * 0.0008
    const angle = baseAngle + spiralSpeed
    const dist = 120 - ((timestamp * 0.02 + v * 10) % 120)
    const vx = ringCenterX + Math.cos(angle) * Math.max(0, dist)
    const vy = ringCenterY + Math.sin(angle) * Math.max(0, dist)
    const vortexAlpha = Math.max(0, dist / 120) * 0.2
    ctx.fillStyle = `rgba(255, 0, 255, ${vortexAlpha})`
    ctx.beginPath()
    ctx.arc(vx, vy, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // Void tear / rift effect
  const riftAlpha = 0.03 + Math.sin(timestamp * 0.001) * 0.02
  const riftGrad = ctx.createRadialGradient(ringCenterX, ringCenterY, 0, ringCenterX, ringCenterY, 25)
  riftGrad.addColorStop(0, `rgba(100, 0, 150, ${riftAlpha * 2})`)
  riftGrad.addColorStop(0.5, `rgba(50, 0, 80, ${riftAlpha})`)
  riftGrad.addColorStop(1, 'rgba(20, 0, 40, 0)')
  ctx.fillStyle = riftGrad
  ctx.beginPath()
  ctx.arc(ringCenterX, ringCenterY, 25, 0, Math.PI * 2)
  ctx.fill()

  // Floating void debris
  for (let d = 0; d < 8; d++) {
    const debrisX = W * 0.1 + Math.sin(timestamp * 0.0004 + d * 4.1) * W * 0.35 + d * 30
    const debrisY = H * 0.1 + Math.cos(timestamp * 0.0003 + d * 3.3) * H * 0.35 + d * 20
    const debrisAlpha = 0.05 + Math.sin(timestamp * 0.002 + d) * 0.03
    ctx.fillStyle = `rgba(150, 50, 200, ${debrisAlpha})`
    ctx.save()
    ctx.translate(debrisX, debrisY)
    ctx.rotate(timestamp * 0.001 + d)
    ctx.fillRect(-3, -1, 6, 2)
    ctx.restore()
  }

  // Screen-edge void distortion
  const voidEdge = 0.03 + Math.sin(timestamp * 0.002) * 0.015
  const voidGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75)
  voidGrad.addColorStop(0, 'rgba(10, 0, 20, 0)')
  voidGrad.addColorStop(1, `rgba(10, 0, 20, ${voidEdge})`)
  ctx.fillStyle = voidGrad
  ctx.fillRect(0, 0, W, H)
}

function drawPlayerJet(ctx, x, y, timestamp, shielded) {
  ctx.save()

  // Engine flame
  const flameLen = 14 + Math.sin(timestamp * 0.025) * 5
  const flameGrad = ctx.createLinearGradient(x, y + 18, x, y + 18 + flameLen)
  flameGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  flameGrad.addColorStop(0.25, 'rgba(255, 220, 80, 0.85)')
  flameGrad.addColorStop(0.55, 'rgba(255, 120, 30, 0.6)')
  flameGrad.addColorStop(1, 'rgba(255, 60, 0, 0)')
  ctx.fillStyle = flameGrad
  ctx.beginPath()
  ctx.moveTo(x - 5, y + 18)
  ctx.quadraticCurveTo(x - 2, y + 18 + flameLen * 0.7, x, y + 18 + flameLen)
  ctx.quadraticCurveTo(x + 2, y + 18 + flameLen * 0.7, x + 5, y + 18)
  ctx.fill()

  // Body gradient (metallic blue)
  const bodyGrad = ctx.createLinearGradient(x - 12, 0, x + 12, 0)
  bodyGrad.addColorStop(0, '#3a5a8a')
  bodyGrad.addColorStop(0.25, '#6a9fd8')
  bodyGrad.addColorStop(0.45, '#a8d4f8')
  bodyGrad.addColorStop(0.55, '#a8d4f8')
  bodyGrad.addColorStop(0.75, '#6a9fd8')
  bodyGrad.addColorStop(1, '#3a5a8a')

  // Fuselage
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.moveTo(x, y - 22)          // nose tip
  ctx.lineTo(x + 4, y - 16)
  ctx.lineTo(x + 7, y - 6)
  ctx.lineTo(x + 8, y + 6)
  ctx.lineTo(x + 7, y + 18)     // tail
  ctx.lineTo(x - 7, y + 18)
  ctx.lineTo(x - 8, y + 6)
  ctx.lineTo(x - 7, y - 6)
  ctx.lineTo(x - 4, y - 16)
  ctx.closePath()
  ctx.fill()

  // Wing shadow (dark underside)
  ctx.fillStyle = '#2a4a72'
  // Right wing
  ctx.beginPath()
  ctx.moveTo(x + 6, y - 2)
  ctx.lineTo(x + 24, y + 10)
  ctx.lineTo(x + 22, y + 14)
  ctx.lineTo(x + 7, y + 6)
  ctx.closePath()
  ctx.fill()
  // Left wing
  ctx.beginPath()
  ctx.moveTo(x - 6, y - 2)
  ctx.lineTo(x - 24, y + 10)
  ctx.lineTo(x - 22, y + 14)
  ctx.lineTo(x - 7, y + 6)
  ctx.closePath()
  ctx.fill()

  // Wings (metallic top)
  const wingGrad = ctx.createLinearGradient(x, y - 2, x, y + 14)
  wingGrad.addColorStop(0, '#7ab0e0')
  wingGrad.addColorStop(1, '#4a7ab0')
  ctx.fillStyle = wingGrad
  // Right wing
  ctx.beginPath()
  ctx.moveTo(x + 6, y - 4)
  ctx.lineTo(x + 24, y + 8)
  ctx.lineTo(x + 22, y + 12)
  ctx.lineTo(x + 7, y + 4)
  ctx.closePath()
  ctx.fill()
  // Left wing
  ctx.beginPath()
  ctx.moveTo(x - 6, y - 4)
  ctx.lineTo(x - 24, y + 8)
  ctx.lineTo(x - 22, y + 12)
  ctx.lineTo(x - 7, y + 4)
  ctx.closePath()
  ctx.fill()

  // Wing leading edge highlight
  ctx.strokeStyle = 'rgba(180, 220, 255, 0.4)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x + 6, y - 4)
  ctx.lineTo(x + 24, y + 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 6, y - 4)
  ctx.lineTo(x - 24, y + 8)
  ctx.stroke()

  // Tail fins
  ctx.fillStyle = '#4a7ab0'
  ctx.beginPath()
  ctx.moveTo(x + 5, y + 12)
  ctx.lineTo(x + 14, y + 19)
  ctx.lineTo(x + 11, y + 20)
  ctx.lineTo(x + 6, y + 16)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 5, y + 12)
  ctx.lineTo(x - 14, y + 19)
  ctx.lineTo(x - 11, y + 20)
  ctx.lineTo(x - 6, y + 16)
  ctx.closePath()
  ctx.fill()

  // Vertical stabilizer
  ctx.fillStyle = '#5a8abf'
  ctx.beginPath()
  ctx.moveTo(x, y + 10)
  ctx.lineTo(x + 3, y + 21)
  ctx.lineTo(x - 3, y + 21)
  ctx.closePath()
  ctx.fill()

  // Cockpit
  const cockpitGrad = ctx.createRadialGradient(x, y - 10, 0.5, x, y - 10, 6)
  cockpitGrad.addColorStop(0, '#c8f0ff')
  cockpitGrad.addColorStop(0.4, '#60c8f8')
  cockpitGrad.addColorStop(0.8, '#2888c8')
  cockpitGrad.addColorStop(1, '#1a5a8a')
  ctx.fillStyle = cockpitGrad
  ctx.beginPath()
  ctx.ellipse(x, y - 10, 3.5, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Cockpit glass reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.beginPath()
  ctx.ellipse(x - 1, y - 11.5, 1.5, 2.8, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // Nose cone highlight
  ctx.fillStyle = 'rgba(200, 230, 255, 0.3)'
  ctx.beginPath()
  ctx.moveTo(x, y - 22)
  ctx.lineTo(x + 2, y - 17)
  ctx.lineTo(x - 2, y - 17)
  ctx.closePath()
  ctx.fill()

  // Wing tip navigation lights
  const blink = Math.sin(timestamp * 0.008) > 0
  if (blink) {
    ctx.fillStyle = '#ff2020'
    ctx.shadowColor = '#ff2020'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(x - 24, y + 8, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#20ff20'
    ctx.shadowColor = '#20ff20'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(x + 24, y + 8, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Shield effect
  if (shielded) {
    ctx.strokeStyle = 'rgba(127, 219, 202, 0.5)'
    ctx.lineWidth = 2
    ctx.shadowColor = '#7fdbca'
    ctx.shadowBlur = 15
    ctx.beginPath()
    ctx.arc(x, y, 26 + Math.sin(timestamp * 0.01) * 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
    // Inner shield shimmer
    ctx.strokeStyle = 'rgba(127, 219, 202, 0.15)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(x, y, 24 + Math.sin(timestamp * 0.015) * 2, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

function drawEnemyJet(ctx, x, y, color, isMini) {
  ctx.save()

  const scale = isMini ? 0.55 : 1

  ctx.scale(scale, scale)

  // Body gradient
  const bodyGrad = ctx.createLinearGradient(x - 10, 0, x + 10, 0)
  bodyGrad.addColorStop(0, shadeColor(color, -40))
  bodyGrad.addColorStop(0.3, shadeColor(color, -10))
  bodyGrad.addColorStop(0.5, color)
  bodyGrad.addColorStop(0.7, shadeColor(color, -10))
  bodyGrad.addColorStop(1, shadeColor(color, -40))

  // Fuselage (nose points DOWN — enemies face player)
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.moveTo(x, y + 16)           // nose (bottom)
  ctx.lineTo(x + 4, y + 10)
  ctx.lineTo(x + 6, y + 2)
  ctx.lineTo(x + 7, y - 6)
  ctx.lineTo(x + 6, y - 14)      // tail (top)
  ctx.lineTo(x - 6, y - 14)
  ctx.lineTo(x - 7, y - 6)
  ctx.lineTo(x - 6, y + 2)
  ctx.lineTo(x - 4, y + 10)
  ctx.closePath()
  ctx.fill()

  // Wings
  ctx.fillStyle = shadeColor(color, -25)
  // Right wing
  ctx.beginPath()
  ctx.moveTo(x + 5, y - 2)
  ctx.lineTo(x + 18, y + 4)
  ctx.lineTo(x + 17, y + 7)
  ctx.lineTo(x + 6, y + 2)
  ctx.closePath()
  ctx.fill()
  // Left wing
  ctx.beginPath()
  ctx.moveTo(x - 5, y - 2)
  ctx.lineTo(x - 18, y + 4)
  ctx.lineTo(x - 17, y + 7)
  ctx.lineTo(x - 6, y + 2)
  ctx.closePath()
  ctx.fill()

  // Wing highlights
  ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x + 5, y - 2)
  ctx.lineTo(x + 18, y + 4)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 5, y - 2)
  ctx.lineTo(x - 18, y + 4)
  ctx.stroke()

  // Tail fins
  ctx.fillStyle = shadeColor(color, -20)
  ctx.beginPath()
  ctx.moveTo(x + 4, y - 10)
  ctx.lineTo(x + 11, y - 14)
  ctx.lineTo(x + 9, y - 15)
  ctx.lineTo(x + 5, y - 12)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 4, y - 10)
  ctx.lineTo(x - 11, y - 14)
  ctx.lineTo(x - 9, y - 15)
  ctx.lineTo(x - 5, y - 12)
  ctx.closePath()
  ctx.fill()

  // Cockpit (dark)
  ctx.fillStyle = 'rgba(80, 40, 40, 0.7)'
  ctx.beginPath()
  ctx.ellipse(x, y + 6, 2.5, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Engine glow (top — away from player)
  ctx.fillStyle = 'rgba(255, 100, 50, 0.4)'
  ctx.beginPath()
  ctx.arc(x, y - 14, 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawBossJet(ctx, boss, timestamp) {
  ctx.save()
  const x = boss.x
  const y = boss.y

  // Ambient glow behind boss
  const glowGrad = ctx.createRadialGradient(x, y, 5, x, y, 50)
  glowGrad.addColorStop(0, boss.accentColor + '30')
  glowGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = glowGrad
  ctx.beginPath()
  ctx.arc(x, y, 50, 0, Math.PI * 2)
  ctx.fill()

  switch (boss.level) {
    case 1: drawIronBulwark(ctx, x, y, timestamp, boss); break
    case 2: drawStormDancer(ctx, x, y, timestamp, boss); break
    case 3: drawSwarmQueen(ctx, x, y, timestamp, boss); break
    case 4: drawSniperPhantom(ctx, x, y, timestamp, boss); break
    case 5: drawVoidEmperor(ctx, x, y, timestamp, boss); break
  }

  ctx.restore()
}

// ─── Boss 1: Iron Bulwark ───
function drawIronBulwark(ctx, x, y, timestamp) {
  // Heavy armored body
  const bodyGrad = ctx.createLinearGradient(x - 30, 0, x + 30, 0)
  bodyGrad.addColorStop(0, '#3a4555')
  bodyGrad.addColorStop(0.2, '#5a6a7a')
  bodyGrad.addColorStop(0.4, '#7a8a9a')
  bodyGrad.addColorStop(0.6, '#7a8a9a')
  bodyGrad.addColorStop(0.8, '#5a6a7a')
  bodyGrad.addColorStop(1, '#3a4555')

  // Main hull (thick and broad)
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.moveTo(x, y + 28)
  ctx.lineTo(x + 12, y + 20)
  ctx.lineTo(x + 20, y + 8)
  ctx.lineTo(x + 26, y - 4)
  ctx.lineTo(x + 28, y - 16)
  ctx.lineTo(x + 22, y - 24)
  ctx.lineTo(x - 22, y - 24)
  ctx.lineTo(x - 28, y - 16)
  ctx.lineTo(x - 26, y - 4)
  ctx.lineTo(x - 20, y + 8)
  ctx.lineTo(x - 12, y + 20)
  ctx.closePath()
  ctx.fill()

  // Armor plate lines
  ctx.strokeStyle = 'rgba(100, 120, 140, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x - 20, y + 4)
  ctx.lineTo(x + 20, y + 4)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 24, y - 8)
  ctx.lineTo(x + 24, y - 8)
  ctx.stroke()

  // Heavy wing armor
  ctx.fillStyle = '#4a5a6a'
  ctx.beginPath()
  ctx.moveTo(x + 20, y)
  ctx.lineTo(x + 38, y + 10)
  ctx.lineTo(x + 36, y + 16)
  ctx.lineTo(x + 22, y + 8)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 20, y)
  ctx.lineTo(x - 38, y + 10)
  ctx.lineTo(x - 36, y + 16)
  ctx.lineTo(x - 22, y + 8)
  ctx.closePath()
  ctx.fill()

  // Wing armor highlights
  ctx.strokeStyle = 'rgba(140, 160, 180, 0.3)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x + 20, y)
  ctx.lineTo(x + 38, y + 10)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 20, y)
  ctx.lineTo(x - 38, y + 10)
  ctx.stroke()

  // Weapon ports (glowing blue)
  const portGlow = 0.4 + Math.sin(timestamp * 0.006) * 0.2
  ctx.fillStyle = `rgba(141, 155, 181, ${portGlow})`
  ctx.shadowColor = '#8d9bb5'
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.arc(x - 14, y + 16, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + 14, y + 16, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y + 24, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Central cockpit
  ctx.fillStyle = 'rgba(60, 80, 100, 0.8)'
  ctx.beginPath()
  ctx.ellipse(x, y + 10, 4, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // Tail thrusters
  const thrustLen = 6 + Math.sin(timestamp * 0.02) * 3
  const thrustGrad = ctx.createLinearGradient(x, y - 24, x, y - 24 - thrustLen)
  thrustGrad.addColorStop(0, 'rgba(180, 200, 220, 0.7)')
  thrustGrad.addColorStop(1, 'rgba(100, 120, 140, 0)')
  ctx.fillStyle = thrustGrad
  ctx.beginPath()
  ctx.moveTo(x - 8, y - 24)
  ctx.lineTo(x, y - 24 - thrustLen)
  ctx.lineTo(x + 8, y - 24)
  ctx.fill()
}

// ─── Boss 2: Storm Dancer ───
function drawStormDancer(ctx, x, y, timestamp) {
  // Sleek delta wing shape
  const bodyGrad = ctx.createLinearGradient(x - 20, 0, x + 20, 0)
  bodyGrad.addColorStop(0, '#0a4a3a')
  bodyGrad.addColorStop(0.3, '#1a8a6a')
  bodyGrad.addColorStop(0.5, '#3ae8b0')
  bodyGrad.addColorStop(0.7, '#1a8a6a')
  bodyGrad.addColorStop(1, '#0a4a3a')

  // Main body (sharp and angular)
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.moveTo(x, y + 26)
  ctx.lineTo(x + 8, y + 14)
  ctx.lineTo(x + 14, y + 2)
  ctx.lineTo(x + 18, y - 10)
  ctx.lineTo(x + 14, y - 20)
  ctx.lineTo(x, y - 24)
  ctx.lineTo(x - 14, y - 20)
  ctx.lineTo(x - 18, y - 10)
  ctx.lineTo(x - 14, y + 2)
  ctx.lineTo(x - 8, y + 14)
  ctx.closePath()
  ctx.fill()

  // Delta wings
  ctx.fillStyle = '#0e6a50'
  ctx.beginPath()
  ctx.moveTo(x + 12, y - 4)
  ctx.lineTo(x + 32, y + 8)
  ctx.lineTo(x + 30, y + 14)
  ctx.lineTo(x + 14, y + 4)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 12, y - 4)
  ctx.lineTo(x - 32, y + 8)
  ctx.lineTo(x - 30, y + 14)
  ctx.lineTo(x - 14, y + 4)
  ctx.closePath()
  ctx.fill()

  // Wing edge highlights
  ctx.strokeStyle = 'rgba(58, 232, 176, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + 12, y - 4)
  ctx.lineTo(x + 32, y + 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 12, y - 4)
  ctx.lineTo(x - 32, y + 8)
  ctx.stroke()

  // Lightning energy trails
  const energyAlpha = 0.3 + Math.sin(timestamp * 0.01) * 0.15
  ctx.strokeStyle = `rgba(58, 232, 176, ${energyAlpha})`
  ctx.lineWidth = 1
  for (let i = 0; i < 3; i++) {
    const ex = x + (i - 1) * 20
    ctx.beginPath()
    ctx.moveTo(ex, y - 24)
    ctx.lineTo(ex + (Math.random() - 0.5) * 8, y - 30)
    ctx.lineTo(ex + (Math.random() - 0.5) * 6, y - 36)
    ctx.stroke()
  }

  // Cockpit
  const cockpitGrad = ctx.createRadialGradient(x, y + 8, 1, x, y + 8, 5)
  cockpitGrad.addColorStop(0, '#a0fff0')
  cockpitGrad.addColorStop(0.5, '#3ae8b0')
  cockpitGrad.addColorStop(1, '#0a5a40')
  ctx.fillStyle = cockpitGrad
  ctx.beginPath()
  ctx.ellipse(x, y + 8, 3, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Engine glow
  ctx.fillStyle = 'rgba(58, 232, 176, 0.5)'
  ctx.shadowColor = '#3ae8b0'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.arc(x, y - 24, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

// ─── Boss 3: Swarm Queen ───
function drawSwarmQueen(ctx, x, y, timestamp) {
  // Organic body
  const bodyGrad = ctx.createRadialGradient(x, y, 5, x, y, 30)
  bodyGrad.addColorStop(0, '#c77dff')
  bodyGrad.addColorStop(0.4, '#7b2d8e')
  bodyGrad.addColorStop(0.7, '#5a1a6e')
  bodyGrad.addColorStop(1, '#3a0a4e')

  // Main body (organic curves)
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.moveTo(x, y + 26)
  ctx.bezierCurveTo(x + 15, y + 18, x + 22, y + 5, x + 24, y - 6)
  ctx.bezierCurveTo(x + 20, y - 18, x + 12, y - 24, x, y - 26)
  ctx.bezierCurveTo(x - 12, y - 24, x - 20, y - 18, x - 24, y - 6)
  ctx.bezierCurveTo(x - 22, y + 5, x - 15, y + 18, x, y + 26)
  ctx.fill()

  // Organic membrane wings
  const wingGrad = ctx.createLinearGradient(x, y, x + 35, y + 12)
  wingGrad.addColorStop(0, 'rgba(123, 45, 142, 0.8)')
  wingGrad.addColorStop(1, 'rgba(199, 125, 255, 0.3)')
  ctx.fillStyle = wingGrad
  // Right wing
  ctx.beginPath()
  ctx.moveTo(x + 16, y - 4)
  ctx.bezierCurveTo(x + 28, y - 8, x + 36, y + 2, x + 34, y + 12)
  ctx.bezierCurveTo(x + 30, y + 18, x + 22, y + 10, x + 16, y + 4)
  ctx.fill()
  // Left wing
  ctx.beginPath()
  ctx.moveTo(x - 16, y - 4)
  ctx.bezierCurveTo(x - 28, y - 8, x - 36, y + 2, x - 34, y + 12)
  ctx.bezierCurveTo(x - 30, y + 18, x - 22, y + 10, x - 16, y + 4)
  ctx.fill()

  // Wing veins
  ctx.strokeStyle = 'rgba(199, 125, 255, 0.3)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x + 16, y)
  ctx.lineTo(x + 30, y + 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 16, y)
  ctx.lineTo(x - 30, y + 6)
  ctx.stroke()

  // Spore glow points
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + timestamp * 0.002
    const dist = 28 + Math.sin(timestamp * 0.005 + i) * 4
    const sx = x + Math.cos(angle) * dist
    const sy = y + Math.sin(angle) * dist
    const sporeAlpha = 0.3 + Math.sin(timestamp * 0.008 + i * 1.5) * 0.2
    ctx.fillStyle = `rgba(199, 125, 255, ${sporeAlpha})`
    ctx.shadowColor = '#c77dff'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(sx, sy, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Central eye
  const eyeGrad = ctx.createRadialGradient(x, y + 4, 1, x, y + 4, 5)
  eyeGrad.addColorStop(0, '#ffffff')
  eyeGrad.addColorStop(0.3, '#c77dff')
  eyeGrad.addColorStop(1, '#5a1a6e')
  ctx.fillStyle = eyeGrad
  ctx.beginPath()
  ctx.arc(x, y + 4, 4.5, 0, Math.PI * 2)
  ctx.fill()

  // Antenna feelers
  ctx.strokeStyle = '#7b2d8e'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x - 4, y - 24)
  ctx.quadraticCurveTo(x - 10, y - 32, x - 8 + Math.sin(timestamp * 0.004) * 3, y - 36)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + 4, y - 24)
  ctx.quadraticCurveTo(x + 10, y - 32, x + 8 + Math.sin(timestamp * 0.004 + 1) * 3, y - 36)
  ctx.stroke()
  // Antenna tips
  ctx.fillStyle = '#c77dff'
  ctx.shadowColor = '#c77dff'
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(x - 8 + Math.sin(timestamp * 0.004) * 3, y - 36, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + 8 + Math.sin(timestamp * 0.004 + 1) * 3, y - 36, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

// ─── Boss 4: Sniper Phantom ───
function drawSniperPhantom(ctx, x, y, timestamp, boss) {
  const alpha = boss.visible ? (boss.phaseTimer > 70 ? 0.4 + Math.sin(timestamp * 0.02) * 0.3 : 0.9) : 0.15
  ctx.globalAlpha = alpha

  // Stealth flying wing design
  const bodyGrad = ctx.createLinearGradient(x - 30, 0, x + 30, 0)
  bodyGrad.addColorStop(0, '#2a0a18')
  bodyGrad.addColorStop(0.3, '#4a1a2e')
  bodyGrad.addColorStop(0.5, '#6a2a3e')
  bodyGrad.addColorStop(0.7, '#4a1a2e')
  bodyGrad.addColorStop(1, '#2a0a18')

  // B-2 style flying wing
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.moveTo(x, y + 26)
  ctx.lineTo(x + 10, y + 16)
  ctx.lineTo(x + 28, y + 6)
  ctx.lineTo(x + 34, y - 4)
  ctx.lineTo(x + 28, y - 14)
  ctx.lineTo(x + 16, y - 22)
  ctx.lineTo(x + 6, y - 26)
  ctx.lineTo(x - 6, y - 26)
  ctx.lineTo(x - 16, y - 22)
  ctx.lineTo(x - 28, y - 14)
  ctx.lineTo(x - 34, y - 4)
  ctx.lineTo(x - 28, y + 6)
  ctx.lineTo(x - 10, y + 16)
  ctx.closePath()
  ctx.fill()

  // Edge glow (stealth outline)
  ctx.strokeStyle = `rgba(255, 51, 102, ${0.3 + Math.sin(timestamp * 0.005) * 0.15})`
  ctx.lineWidth = 1
  ctx.shadowColor = '#ff3366'
  ctx.shadowBlur = 6
  ctx.stroke()
  ctx.shadowBlur = 0

  // Targeting laser effect
  const laserAlpha = 0.15 + Math.sin(timestamp * 0.008) * 0.1
  ctx.strokeStyle = `rgba(255, 51, 102, ${laserAlpha})`
  ctx.lineWidth = 1
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.moveTo(x, y + 26)
  ctx.lineTo(x, y + 60)
  ctx.stroke()
  ctx.setLineDash([])

  // Central sensor
  ctx.fillStyle = '#ff3366'
  ctx.shadowColor = '#ff3366'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.arc(x, y + 6, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Inner sensor ring
  ctx.strokeStyle = 'rgba(255, 51, 102, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(x, y + 6, 6, 0, Math.PI * 2)
  ctx.stroke()

  ctx.globalAlpha = 1
}

// ─── Boss 5: Void Emperor ───
function drawVoidEmperor(ctx, x, y, timestamp) {
  // Rotating energy ring
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(timestamp * 0.001)
  ctx.strokeStyle = 'rgba(255, 0, 255, 0.2)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 38, 0, Math.PI * 1.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 42, Math.PI * 0.5, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Massive dark body
  const bodyGrad = ctx.createRadialGradient(x, y, 5, x, y, 35)
  bodyGrad.addColorStop(0, '#5a1a7e')
  bodyGrad.addColorStop(0.3, '#2a0a3e')
  bodyGrad.addColorStop(0.6, '#1a0528')
  bodyGrad.addColorStop(1, '#0a0010')

  // Main hull (massive)
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.moveTo(x, y + 30)
  ctx.lineTo(x + 14, y + 20)
  ctx.lineTo(x + 24, y + 6)
  ctx.lineTo(x + 32, y - 6)
  ctx.lineTo(x + 30, y - 18)
  ctx.lineTo(x + 20, y - 26)
  ctx.lineTo(x + 10, y - 30)
  ctx.lineTo(x - 10, y - 30)
  ctx.lineTo(x - 20, y - 26)
  ctx.lineTo(x - 30, y - 18)
  ctx.lineTo(x - 32, y - 6)
  ctx.lineTo(x - 24, y + 6)
  ctx.lineTo(x - 14, y + 20)
  ctx.closePath()
  ctx.fill()

  // Crown / top structure
  ctx.fillStyle = '#3a1a5e'
  ctx.beginPath()
  ctx.moveTo(x, y - 36)
  ctx.lineTo(x + 6, y - 30)
  ctx.lineTo(x + 4, y - 26)
  ctx.lineTo(x - 4, y - 26)
  ctx.lineTo(x - 6, y - 30)
  ctx.closePath()
  ctx.fill()

  // Crown gems
  ctx.fillStyle = '#ff00ff'
  ctx.shadowColor = '#ff00ff'
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.arc(x, y - 34, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x - 5, y - 29, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + 5, y - 29, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Massive wings
  const wingGrad = ctx.createLinearGradient(x, y, x + 35, y)
  wingGrad.addColorStop(0, '#2a0a3e')
  wingGrad.addColorStop(1, 'rgba(255, 0, 255, 0.15)')
  ctx.fillStyle = wingGrad
  ctx.beginPath()
  ctx.moveTo(x + 22, y - 2)
  ctx.lineTo(x + 38, y + 8)
  ctx.lineTo(x + 40, y + 14)
  ctx.lineTo(x + 24, y + 6)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 22, y - 2)
  ctx.lineTo(x - 38, y + 8)
  ctx.lineTo(x - 40, y + 14)
  ctx.lineTo(x - 24, y + 6)
  ctx.closePath()
  ctx.fill()

  // Wing energy traces
  ctx.strokeStyle = 'rgba(255, 0, 255, 0.25)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x + 22, y - 2)
  ctx.lineTo(x + 38, y + 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 22, y - 2)
  ctx.lineTo(x - 38, y + 8)
  ctx.stroke()

  // Central void eye
  const eyeGrad = ctx.createRadialGradient(x, y + 8, 1, x, y + 8, 7)
  eyeGrad.addColorStop(0, '#ffffff')
  eyeGrad.addColorStop(0.2, '#ff80ff')
  eyeGrad.addColorStop(0.5, '#ff00ff')
  eyeGrad.addColorStop(1, '#2a0a3e')
  ctx.fillStyle = eyeGrad
  ctx.shadowColor = '#ff00ff'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(x, y + 8, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Multiple engine exhausts
  const thrustLen = 8 + Math.sin(timestamp * 0.02) * 4
  for (let i = -1; i <= 1; i++) {
    const ex = x + i * 8
    const thrustGrad = ctx.createLinearGradient(ex, y + 30, ex, y + 30 + thrustLen)
    thrustGrad.addColorStop(0, 'rgba(255, 0, 255, 0.6)')
    thrustGrad.addColorStop(0.5, 'rgba(128, 0, 128, 0.3)')
    thrustGrad.addColorStop(1, 'rgba(50, 0, 50, 0)')
    ctx.fillStyle = thrustGrad
    ctx.beginPath()
    ctx.moveTo(ex - 3, y + 30)
    ctx.lineTo(ex, y + 30 + thrustLen)
    ctx.lineTo(ex + 3, y + 30)
    ctx.fill()
  }

  // Void particles orbiting
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + timestamp * 0.003
    const dist = 32 + Math.sin(timestamp * 0.004 + i) * 3
    const px = x + Math.cos(angle) * dist
    const py = y + Math.sin(angle) * dist
    ctx.fillStyle = `rgba(255, 0, 255, ${0.15 + Math.sin(timestamp * 0.006 + i) * 0.1})`
    ctx.beginPath()
    ctx.arc(px, py, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─── Utility: shade color ───
function shadeColor(color, amount) {
  let r = parseInt(color.slice(1, 3), 16) + amount
  let g = parseInt(color.slice(3, 5), 16) + amount
  let b = parseInt(color.slice(5, 7), 16) + amount
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ─── Floating text system ───────────────────────────────────────
let floatingTexts = []

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, color, life: 1, vy: -1.5 })
}

// ─── Game mechanics ─────────────────────────────────────────────
function fireBullets(gs, timestamp) {
  if (timestamp - gs.lastFireTime < gs.upgrades.fireRate) return
  gs.lastFireTime = timestamp

  const spread = gs.upgrades.bulletSpread
  const centerX = gs.player.x
  const startY = gs.player.y - 20

  if (spread === 1) {
    gs.bullets.push({ x: centerX, y: startY, vx: 0, damage: gs.upgrades.bulletDamage })
  } else {
    const totalAngle = 30
    const step = totalAngle / (spread - 1)
    for (let i = 0; i < spread; i++) {
      const angleDeg = -totalAngle / 2 + i * step
      const angleRad = (angleDeg * Math.PI) / 180
      gs.bullets.push({
        x: centerX, y: startY,
        vx: Math.sin(angleRad) * 3,
        damage: gs.upgrades.bulletDamage,
      })
    }
  }
}

function spawnRegularEnemy(gs, W, lvlConfig) {
  const enemy = {
    id: Date.now() + Math.random(),
    x: 20 + Math.random() * (W - 40),
    y: -20,
    w: 24, h: 24,
    hp: lvlConfig.enemyHp,
    maxHp: lvlConfig.enemyHp,
    speed: lvlConfig.enemySpeed + Math.random() * 0.8,
    drift: (Math.random() - 0.5) * 2,
    color: ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)],
    isBoss: false,
    isMini: false,
  }
  gs.enemies.push(enemy)
}

// ─── Boss attack logic ──────────────────────────────────────────
function bossAttack(boss, gs, W, H) {
  if (!boss || boss.hp <= 0) return

  boss.attackFrame++
  if (boss.attackFrame < boss.attackInterval) return

  boss.attackFrame = 0

  switch (boss.attackPattern) {
    case 'burst': {
      for (let i = 0; i < boss.bulletCount; i++) {
        gs.enemyBullets.push({
          x: boss.x + (i - boss.bulletCount / 2) * 12,
          y: boss.y + 20,
          vx: 0, vy: boss.bulletSpeed,
          color: '#8d9bb5',
        })
      }
      break
    }
    case 'spread': {
      for (let i = 0; i < boss.bulletCount; i++) {
        const angle = Math.PI / 2 + (i - boss.bulletCount / 2) * 0.4
        gs.enemyBullets.push({
          x: boss.x, y: boss.y + 15,
          vx: Math.cos(angle) * boss.bulletSpeed,
          vy: Math.sin(angle) * boss.bulletSpeed,
          color: '#3ae8b0',
        })
      }
      break
    }
    case 'spawn': {
      for (let i = 0; i < 2; i++) {
        gs.enemies.push({
          id: Date.now() + Math.random(),
          x: 20 + Math.random() * (W - 40),
          y: -10 - Math.random() * 20,
          w: 12, h: 12,
          hp: 2, maxHp: 2,
          speed: 2 + Math.random(),
          drift: (Math.random() - 0.5) * 3,
          color: '#c77dff',
          isBoss: false,
          isMini: true,
        })
      }
      gs.enemyBullets.push({
        x: boss.x - 10, y: boss.y + 15,
        vx: -1, vy: boss.bulletSpeed,
        color: '#c77dff',
      })
      gs.enemyBullets.push({
        x: boss.x + 10, y: boss.y + 15,
        vx: 1, vy: boss.bulletSpeed,
        color: '#c77dff',
      })
      break
    }
    case 'aimed': {
      const dx = gs.player.x - boss.x
      const dy = gs.player.y - boss.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0) {
        gs.enemyBullets.push({
          x: boss.x, y: boss.y + 15,
          vx: (dx / dist) * boss.bulletSpeed,
          vy: (dy / dist) * boss.bulletSpeed,
          color: '#ff3366',
        })
      }
      break
    }
    case 'chaos': {
      const phase = Math.floor(boss.attackFrame / 30) % 4
      if (phase === 0 || phase === 2) {
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          gs.enemyBullets.push({
            x: boss.x, y: boss.y,
            vx: Math.cos(angle) * boss.bulletSpeed * 0.7,
            vy: Math.sin(angle) * boss.bulletSpeed * 0.7,
            color: '#ff00ff',
          })
        }
      } else if (phase === 1) {
        const dx = gs.player.x - boss.x
        const dy = gs.player.y - boss.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          for (let i = -1; i <= 1; i++) {
            gs.enemyBullets.push({
              x: boss.x, y: boss.y + 15,
              vx: (dx / dist) * boss.bulletSpeed + i * 1.5,
              vy: (dy / dist) * boss.bulletSpeed,
              color: '#ff00ff',
            })
          }
        }
      } else {
        gs.enemies.push({
          id: Date.now() + Math.random(),
          x: 20 + Math.random() * (W - 40),
          y: -10 - Math.random() * 20,
          w: 12, h: 12,
          hp: 3, maxHp: 3,
          speed: 2.5,
          drift: (Math.random() - 0.5) * 3,
          color: '#ff00ff',
          isBoss: false,
          isMini: true,
        })
      }
      break
    }
  }
}

// ─── Main component ─────────────────────────────────────────────
export default function AirplaneGame() {
  const canvasRef = useRef(null)
  const runningRef = useRef(true)
  const [score, setScore] = useState(0)
  const [hp, setHp] = useState(100)
  const [gameOver, setGameOver] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [showLevelIntro, setShowLevelIntro] = useState(false)
  const [levelIntroText, setLevelIntroText] = useState('')
  const [levelIntroBoss, setLevelIntroBoss] = useState('')
  const [started, setStarted] = useState(false)
  const [musicOn, setMusicOn] = useState(true)

  useEffect(() => {
    if (!started) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const W = Math.min(480, window.innerWidth - 40)
    const H = Math.min(720, window.innerHeight - 120)
    canvas.width = W
    canvas.height = H

    // ── Game state ──
    const gs = {
      player: { x: W / 2, y: H - 80, w: 32, h: 32, hp: 100, maxHp: 100 },
      bullets: [],
      missiles: [],
      enemies: [],
      enemyBullets: [],
      particles: [],
      powerUps: [],
      score: 0,
      combo: 0,
      currentLevel: 1,
      enemiesRemaining: LEVELS[0].enemiesToDefeat,
      upgrades: {
        fireRate: 200,
        bulletSpread: 1,
        bulletDamage: 1,
        shield: false,
        speedMultiplier: 1,
        scoreMultiplier: 1,
      },
      lastFireTime: 0,
      lastSpawnTime: 0,
      spawnInterval: LEVELS[0].spawnInterval,
      dragTarget: null,
      isDragging: false,
      boss: null,
      bossActive: false,
      bossIntroTimer: 0,
      levelTransition: false,
      levelTransitionTimer: 0,
      frameCount: 0,
      shake: 0,
      flashAlpha: 0,
      rings: [],
    }

    // ── FX helpers ──
    function shakeScreen(gs, amt) {
      gs.shake = Math.max(gs.shake, amt)
    }
    function damageFlash(gs, amt) {
      gs.flashAlpha = Math.max(gs.flashAlpha, amt)
    }
    function addRing(gs, x, y, color, maxR, width) {
      gs.rings.push({ x, y, r: 6, maxR: maxR || 60, color: color || '#ffd166', w: width || 3, life: 1 })
    }
    function sparkBurst(gs, x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const s = (0.5 + Math.random()) * (speed || 3)
        gs.particles.push({
          x, y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0.4 + Math.random() * 0.4,
          color, size: 1 + Math.random() * 1.5,
          type: 'spark',
        })
      }
    }

    // ── Start level ──
    function startLevel(levelNum) {
      const lvl = LEVELS[levelNum - 1]
      gs.currentLevel = levelNum
      gs.enemiesRemaining = lvl.enemiesToDefeat
      gs.spawnInterval = lvl.spawnInterval
      gs.boss = null
      gs.bossActive = false
      gs.enemies = []
      gs.enemyBullets = []
      gs.powerUps = []
      gs.bullets = []
      gs.missiles = []
      // Power-ups carry over between levels — only reset on a brand-new game (level 1)
      if (levelNum === 1) {
        gs.upgrades = {
          fireRate: 200,
          bulletSpread: 1,
          bulletDamage: 1,
          shield: false,
          speedMultiplier: 1,
          scoreMultiplier: 1,
        }
      }
      gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 30)
      setHp(gs.player.hp)
      setCurrentLevel(levelNum)

      const bossDef = BOSSES[levelNum - 1]
      setLevelIntroText(bossDef.intro)
      setLevelIntroBoss(bossDef.name)
      setShowLevelIntro(true)
      gs.levelTransition = true
      gs.levelTransitionTimer = 120
      gs.lastSpawnTime = performance.now() // defer first spawn until after the intro

      setTimeout(() => {
        setShowLevelIntro(false)
        gs.levelTransition = false
        gs.lastSpawnTime = performance.now() // start the spawn clock only now
      }, 2000)
    }

    // ── Spawn boss ──
    function spawnBoss(levelNum) {
      const bossDef = BOSSES[levelNum - 1]
      gs.boss = {
        ...bossDef,
        x: W / 2,
        y: -60,
        w: 45,
        h: 45,
        attackFrame: 0,
        visible: true,
        phaseTimer: 0,
        regenTimer: 0,
        enterPhase: true,
      }
      gs.bossActive = true
      gs.spawnInterval = 999999
      addFloatingText(`⚠️ ${bossDef.name} ⚠️`, W / 2, H / 2 - 40, bossDef.accentColor)
      // Boss spawn: warning ring + red flash
      addRing(gs, W / 2, H / 2, '#ff4444', 180)
      addRing(gs, W / 2, H / 2, bossDef.accentColor || '#ff8800', 260)
      damageFlash(gs, 0.5)
      shakeScreen(gs, 10)
      for (let i = 0; i < 20; i++) {
        gs.particles.push({
          x: W / 2, y: H / 2,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 1, color: bossDef.accentColor || '#ff8800', size: 3, type: 'spark',
        })
      }
    }

    // ── Input handling ──
    function getCanvasPos(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      return {
        x: (clientX - rect.left) * (W / rect.width),
        y: (clientY - rect.top) * (H / rect.height),
      }
    }

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      const touch = e.touches[0]
      gs.isDragging = true
      gs.dragTarget = getCanvasPos(touch.clientX, touch.clientY)
    }, { passive: false })

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      if (!gs.isDragging) return
      const touch = e.touches[0]
      gs.dragTarget = getCanvasPos(touch.clientX, touch.clientY)
    }, { passive: false })

    canvas.addEventListener('touchend', () => {
      gs.isDragging = false
      gs.dragTarget = null
    })

    canvas.addEventListener('mousedown', (e) => {
      gs.isDragging = true
      gs.dragTarget = getCanvasPos(e.clientX, e.clientY)
    })

    canvas.addEventListener('mousemove', (e) => {
      if (!gs.isDragging) return
      gs.dragTarget = getCanvasPos(e.clientX, e.clientY)
    })

    canvas.addEventListener('mouseup', () => {
      gs.isDragging = false
      gs.dragTarget = null
    })

    canvas.addEventListener('mouseleave', () => {
      gs.isDragging = false
      gs.dragTarget = null
    })

    // ── Update ──
    function update(timestamp) {
      gs.frameCount++

      // Player movement
      if (gs.isDragging && gs.dragTarget) {
        const speed = 8 * gs.upgrades.speedMultiplier
        const dx = gs.dragTarget.x - gs.player.x
        const dy = gs.dragTarget.y - gs.player.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 2) {
          gs.player.x += (dx / dist) * Math.min(speed, dist)
          gs.player.y += (dy / dist) * Math.min(speed, dist)
        }
        gs.player.x = Math.max(16, Math.min(W - 16, gs.player.x))
        gs.player.y = Math.max(16, Math.min(H - 16, gs.player.y))
      }

      // Fire bullets
      const firedBefore = gs.bullets.length
      fireBullets(gs, timestamp)
      if (gs.bullets.length > firedBefore) {
        // Muzzle flash on the frames where a shot actually fires
        sparkBurst(gs, gs.player.x, gs.player.y - 22, '#7fdbca', 3, 2.2)
        sfx.shoot()
      }

      // Player engine trail (subtle, every 2nd frame)
      if (gs.frameCount % 2 === 0 && gs.player.hp > 0) {
        gs.particles.push({
          x: gs.player.x + (Math.random() - 0.5) * 4,
          y: gs.player.y + 14,
          vx: (Math.random() - 0.5) * 0.6,
          vy: 1.2 + Math.random() * 1.2,
          life: 0.5,
          color: gs.upgrades.shield ? '#7fdbca' : '#ffb74d',
          size: 1.5 + Math.random() * 1.5,
          type: 'trail',
        })
      }

      // Spawn regular enemies (not during level intro / boss)
      if (!gs.bossActive && !gs.levelTransition && gs.enemiesRemaining > 0) {
        if (timestamp - gs.lastSpawnTime >= gs.spawnInterval) {
          gs.lastSpawnTime = timestamp
          spawnRegularEnemy(gs, W, LEVELS[gs.currentLevel - 1])
        }
      }

      // ── Boss logic ──
      if (gs.boss && gs.boss.hp > 0) {
        const boss = gs.boss

        if (boss.enterPhase) {
          boss.y += 1.5
          if (boss.y >= 100) {
            boss.y = 100
            boss.enterPhase = false
          }
        } else {
          switch (boss.defense) {
            case 'armor':
              boss.x += Math.sin(gs.frameCount * 0.02) * boss.drift
              boss.y += Math.cos(gs.frameCount * 0.015) * 0.5
              break
            case 'dodge':
              boss.x += Math.sin(gs.frameCount * 0.05) * boss.drift
              boss.y += Math.cos(gs.frameCount * 0.03) * 1
              break
            case 'minions':
              boss.x += Math.sin(gs.frameCount * 0.015) * boss.drift * 0.7
              boss.y += Math.cos(gs.frameCount * 0.02) * 0.5
              break
            case 'phase': {
              boss.phaseTimer++
              if (boss.phaseTimer > 90) {
                boss.phaseTimer = 0
                boss.visible = !boss.visible
                boss.x = 40 + Math.random() * (W - 80)
                boss.y = 40 + Math.random() * 120
              }
              break
            }
            case 'regen':
              boss.x += Math.sin(gs.frameCount * 0.02) * boss.drift * 0.8
              boss.y += Math.cos(gs.frameCount * 0.015) * 0.8
              boss.regenTimer++
              if (boss.regenTimer > 120 && boss.hp < boss.maxHp) {
                boss.regenTimer = 0
                boss.hp = Math.min(boss.maxHp, boss.hp + 1)
              }
              break
          }

          boss.x = Math.max(30, Math.min(W - 30, boss.x))
          boss.y = Math.max(30, Math.min(200, boss.y))
        }

        if (!boss.enterPhase) {
          bossAttack(boss, gs, W, H)
        }
      }

      // Update player bullets
      for (let i = gs.bullets.length - 1; i >= 0; i--) {
        const b = gs.bullets[i]
        b.y -= 8
        if (b.vx) b.x += b.vx
        if (b.y < -20) gs.bullets.splice(i, 1)
      }

      // Update missiles
      for (let i = gs.missiles.length - 1; i >= 0; i--) {
        const m = gs.missiles[i]
        m.lifetime--

        let targets = [...gs.enemies]
        if (gs.boss && gs.boss.hp > 0 && !gs.boss.enterPhase) targets.push(gs.boss)

        let nearest = null
        let nearestDist = Infinity
        for (const e of targets) {
          const d = Math.sqrt((e.x - m.x) ** 2 + (e.y - m.y) ** 2)
          if (d < nearestDist) { nearestDist = d; nearest = e }
        }

        if (nearest) {
          const dx = nearest.x - m.x
          const dy = nearest.y - m.y
          const angle = Math.atan2(dy, dx)
          m.vx = m.vx * 0.85 + Math.cos(angle) * m.speed * 0.15
          m.vy = m.vy * 0.85 + Math.sin(angle) * m.speed * 0.15
          const currentSpeed = Math.sqrt(m.vx * m.vx + m.vy * m.vy)
          if (currentSpeed > 0) {
            m.vx = (m.vx / currentSpeed) * m.speed
            m.vy = (m.vy / currentSpeed) * m.speed
          }
        }

        m.x += m.vx
        m.y += m.vy
        if (m.x < -20 || m.x > W + 20 || m.y < -20 || m.y > H + 20 || m.lifetime <= 0) {
          gs.missiles.splice(i, 1)
        }
      }

      // Update regular enemies
      for (let i = gs.enemies.length - 1; i >= 0; i--) {
        const e = gs.enemies[i]
        e.y += e.speed
        e.x += e.drift
        if (e.x < 8 || e.x > W - 8) e.drift = -e.drift
        if (e.y > H + 30) {
          gs.enemies.splice(i, 1)
          gs.combo = 0
        }
      }

      // Update enemy bullets
      for (let i = gs.enemyBullets.length - 1; i >= 0; i--) {
        const b = gs.enemyBullets[i]
        b.x += b.vx
        b.y += b.vy
        if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
          gs.enemyBullets.splice(i, 1)
        }
      }

      // ── Bullet-enemy collision ──
      for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
        const b = gs.bullets[bi]
        if (!b) continue

        for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
          const e = gs.enemies[ei]
          if (!e) continue
          if (Math.abs(b.x - e.x) < 16 && Math.abs(b.y - e.y) < 16) {
            e.hp -= b.damage
            gs.bullets.splice(bi, 1)
            sparkBurst(gs, b.x, b.y, '#e0fff8', 5, 3)
            sfx.hitEnemy()
            if (e.hp <= 0) {
              destroyEnemy(e, gs)
              gs.enemies.splice(ei, 1)
            }
            break
          }
        }

        if (gs.bullets[bi] && gs.boss && gs.boss.hp > 0 && !gs.boss.enterPhase && gs.boss.visible) {
          const b2 = gs.bullets[bi]
          if (Math.abs(b2.x - gs.boss.x) < 28 && Math.abs(b2.y - gs.boss.y) < 28) {
            let dmg = b2.damage
            if (gs.boss.defense === 'armor') dmg = Math.max(1, Math.floor(dmg / 2))
            gs.boss.hp -= dmg
            gs.bullets.splice(bi, 1)

            for (let p = 0; p < 4; p++) {
              gs.particles.push({
                x: b2.x, y: b2.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 0.8,
                color: gs.boss.accentColor,
                size: 2,
              })
            }

            if (gs.boss.hp <= 0) {
              bossDestroyed(gs)
            }
          }
        }
      }

      // ── Missile-enemy collision ──
      for (let mi = gs.missiles.length - 1; mi >= 0; mi--) {
        const m = gs.missiles[mi]
        if (!m) continue

        for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
          const e = gs.enemies[ei]
          if (!e) continue
          if (Math.abs(m.x - e.x) < 16 && Math.abs(m.y - e.y) < 16) {
            e.hp -= m.damage
            gs.missiles.splice(mi, 1)
            missileExplosion(m.x, m.y, gs)
            if (e.hp <= 0) {
              destroyEnemy(e, gs)
              gs.enemies.splice(ei, 1)
            }
            break
          }
        }

        if (gs.missiles[mi] && gs.boss && gs.boss.hp > 0 && !gs.boss.enterPhase && gs.boss.visible) {
          const m2 = gs.missiles[mi]
          if (Math.abs(m2.x - gs.boss.x) < 28 && Math.abs(m2.y - gs.boss.y) < 28) {
            let dmg = m2.damage
            if (gs.boss.defense === 'armor') dmg = Math.max(1, Math.floor(dmg / 2))
            gs.boss.hp -= dmg
            gs.missiles.splice(mi, 1)
            missileExplosion(m2.x, m2.y, gs)
            if (gs.boss.hp <= 0) {
              bossDestroyed(gs)
            }
          }
        }
      }

      // ── Enemy bullet - player collision ──
      for (let i = gs.enemyBullets.length - 1; i >= 0; i--) {
        const b = gs.enemyBullets[i]
        if (Math.abs(b.x - gs.player.x) < 14 && Math.abs(b.y - gs.player.y) < 14) {
          if (!gs.upgrades.shield) {
            gs.player.hp -= 10
            setHp(gs.player.hp)
            damageFlash(gs, 0.35)
            shakeScreen(gs, 6)
            sfx.playerHit()
            if (gs.player.hp <= 0) {
              runningRef.current = false
              setGameOver(true)
            }
          } else {
            // Shield absorbed the hit — cyan ripple
            addRing(gs, gs.player.x, gs.player.y, '#7fdbca', 34)
            sparkBurst(gs, b.x, b.y, '#7fdbca', 4, 3)
            sfx.shieldHit()
          }
          gs.enemyBullets.splice(i, 1)
          for (let p = 0; p < 4; p++) {
            gs.particles.push({
              x: b.x, y: b.y,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              life: 0.6, color: '#ff6b6b', size: 2,
            })
          }
        }
      }

      // ── Player-enemy collision ──
      for (let i = gs.enemies.length - 1; i >= 0; i--) {
        const e = gs.enemies[i]
        if (Math.abs(e.x - gs.player.x) < 20 && Math.abs(e.y - gs.player.y) < 20) {
          if (!gs.upgrades.shield) {
            gs.player.hp -= 20
            setHp(gs.player.hp)
            damageFlash(gs, 0.5)
            shakeScreen(gs, 9)
            sfx.playerHit()
            if (gs.player.hp <= 0) {
              runningRef.current = false
              setGameOver(true)
            }
          } else {
            addRing(gs, gs.player.x, gs.player.y, '#7fdbca', 40)
            sparkBurst(gs, e.x, e.y, '#7fdbca', 6, 3.5)
            sfx.shieldHit()
          }
          enemyExplosion(e.x, e.y, gs)
          gs.enemies.splice(i, 1)
          gs.combo = 0
        }
      }

      // ── Player-boss collision ──
      if (gs.boss && gs.boss.hp > 0 && !gs.boss.enterPhase && gs.boss.visible) {
        if (Math.abs(gs.boss.x - gs.player.x) < 30 && Math.abs(gs.boss.y - gs.player.y) < 30) {
          if (!gs.upgrades.shield) {
            gs.player.hp -= 15
            setHp(gs.player.hp)
            damageFlash(gs, 0.45)
            shakeScreen(gs, 8)
            sfx.playerHit()
            if (gs.player.hp <= 0) {
              runningRef.current = false
              setGameOver(true)
            }
          }
        }
      }

      // ── Power-up collection ──
      for (let i = gs.powerUps.length - 1; i >= 0; i--) {
        const p = gs.powerUps[i]
        p.y += 1
        if (p.y > H + 20) { gs.powerUps.splice(i, 1); continue }
        if (Math.abs(p.x - gs.player.x) < 20 && Math.abs(p.y - gs.player.y) < 20) {
          const puDef = POWER_UP_TYPES.find(t => t.id === p.type)
          if (puDef) {
            puDef.apply(gs)
            setHp(gs.player.hp)
            sfx.powerup()
            addFloatingText(`${puDef.icon} ${puDef.name}`, p.x, p.y, puDef.color)
            // Pickup burst: shockwave ring + radial sparks
            addRing(gs, p.x, p.y, puDef.color, 60)
            for (let s = 0; s < 12; s++) {
              const ang = (s / 12) * Math.PI * 2
              gs.particles.push({
                x: p.x, y: p.y,
                vx: Math.cos(ang) * 4,
                vy: Math.sin(ang) * 4,
                life: 1, color: puDef.color, size: 2.5, type: 'spark',
              })
            }
            for (let s = 0; s < 6; s++) {
              gs.particles.push({
                x: p.x, y: p.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1, color: puDef.color, size: 2,
              })
            }
          }
          gs.powerUps.splice(i, 1)
        }
      }

      // Update particles
      for (let i = gs.particles.length - 1; i >= 0; i--) {
        const p = gs.particles[i]
        p.x += p.vx
        p.y += p.vy
        if (p.type === 'spark') {
          p.vx *= 0.92
          p.vy = p.vy * 0.92 + 0.08
        } else if (p.type === 'fire') {
          p.vx *= 0.96
          p.vy = p.vy * 0.96 + 0.04
        } else if (p.type === 'smoke') {
          p.vx *= 0.98
          p.vy *= 0.98
        } else if (p.type === 'trail') {
          p.vy += 0.05
        }
        p.life -= p.type === 'trail' ? 0.05 : 0.03
        if (p.life <= 0) gs.particles.splice(i, 1)
      }

      // Update shockwave rings
      for (let i = gs.rings.length - 1; i >= 0; i--) {
        const r = gs.rings[i]
        r.r += (r.maxR - r.r) * 0.22
        r.life -= 0.07
        if (r.life <= 0) gs.rings.splice(i, 1)
      }

      // Decay screen shake + damage flash
      gs.shake *= 0.85
      if (gs.shake < 0.3) gs.shake = 0
      gs.flashAlpha *= 0.88
      if (gs.flashAlpha < 0.02) gs.flashAlpha = 0

      // Update floating texts
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i]
        ft.y += ft.vy
        ft.life -= 0.015
        if (ft.life <= 0) floatingTexts.splice(i, 1)
      }
    }

    // ── Helper: destroy regular enemy ──
    function destroyEnemy(e, gs) {
      gs.combo++
      const points = 10 * gs.combo * gs.upgrades.scoreMultiplier
      gs.score += Math.round(points)
      setScore(gs.score)
      gs.enemiesRemaining--

      enemyExplosion(e.x, e.y, gs)

      const lvl = LEVELS[gs.currentLevel - 1]
      if (Math.random() < lvl.powerUpChance) {
        const puType = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)]
        gs.powerUps.push({
          x: e.x, y: e.y,
          type: puType.id, color: puType.color,
          icon: puType.icon, name: puType.name,
        })
      }

      if (gs.enemiesRemaining <= 0 && !gs.bossActive) {
        // Wave clear celebration — teal sweep before the boss warning
        sfx.levelUp()
        addRing(gs, W / 2, H / 2, '#7fdbca', 200)
        addRing(gs, W / 2, H / 2, '#f5b041', 320)
        addFloatingText('WAVE CLEAR!', W / 2, H / 2 + 20, '#7fdbca')
        for (let i = 0; i < 18; i++) {
          gs.particles.push({
            x: gs.player.x, y: gs.player.y,
            vx: (Math.random() - 0.5) * 9,
            vy: (Math.random() - 0.5) * 9,
            life: 1.2, color: '#7fdbca', size: 2.5, type: 'spark',
          })
        }
        spawnBoss(gs.currentLevel)
        sfx.bossWarn()
      }
    }

    // ── Helper: boss destroyed ──
    function bossDestroyed(gs) {
      // Screen flash + big shake for the kill
      sfx.bossExplosion()
      damageFlash(gs, 0.85)
      shakeScreen(gs, 16)
      addRing(gs, gs.boss.x, gs.boss.y, gs.boss.accentColor, 90, 5)
      addRing(gs, gs.boss.x, gs.boss.y, '#ffffff', 130, 3)
      for (let ring = 0; ring < 3; ring++) {
        setTimeout(() => {
          for (let p = 0; p < 30; p++) {
            const angle = (p / 30) * Math.PI * 2
            const speed = 3 + ring * 2
            gs.particles.push({
              x: gs.boss.x, y: gs.boss.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.5,
              color: gs.boss.accentColor,
              size: 3 + Math.random() * 3,
            })
          }
        }, ring * 200)
      }

      gs.score += 500 * gs.currentLevel
      setScore(gs.score)
      gs.bossActive = false
      gs.boss = null

      addFloatingText(`💀 ${BOSSES[gs.currentLevel - 1].name} DESTROYED!`, W / 2, H / 2, '#f5b041')
      addFloatingText(`+${500 * gs.currentLevel} BONUS`, W / 2, H / 2 + 20, '#7fdbca')

      if (gs.currentLevel < 5) {
        setTimeout(() => {
          if (runningRef.current) {
            startLevel(gs.currentLevel + 1)
          }
        }, 2500)
      } else {
        setTimeout(() => {
          runningRef.current = false
          sfx.victory()
          stopMusic()
          setGameWon(true)
        }, 2500)
      }
    }

    // ── Helper: explosion effects ──
    function enemyExplosion(x, y, gs) {
      sfx.explosion()
      for (let p = 0; p < 14; p++) {
        gs.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 7,
          vy: (Math.random() - 0.5) * 7,
          life: 1,
          color: ['#f5b041', '#f39c12', '#e67e22', '#c0552d', '#fff3d6'][Math.floor(Math.random() * 5)],
          size: 2 + Math.random() * 3,
          type: 'fire',
        })
      }
      // Smoke puff
      for (let p = 0; p < 5; p++) {
        gs.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 2,
          vy: -0.5 - Math.random() * 1,
          life: 0.9,
          color: 'rgba(90,90,100,0.5)',
          size: 3 + Math.random() * 4,
          type: 'smoke',
        })
      }
      addRing(gs, x, y, '#ffd166', 46, 3)
      sparkBurst(gs, x, y, '#fff3d6', 8, 4)
      shakeScreen(gs, 5)
    }

    function missileExplosion(x, y, gs) {
      sfx.explosion()
      for (let p = 0; p < 12; p++) {
        gs.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 0.8,
          color: ['#ff6b6b', '#ff4444', '#ff8888', '#ffe082'][Math.floor(Math.random() * 4)],
          size: 2 + Math.random() * 3,
          type: 'fire',
        })
      }
      addRing(gs, x, y, '#ff8a65', 56, 3)
      sparkBurst(gs, x, y, '#ffe0b2', 10, 5)
      shakeScreen(gs, 7)
    }

    // ── Draw ──
    function draw(timestamp) {
      ctx.save()

      // Screen shake offset
      if (gs.shake > 0) {
        const sx = (Math.random() - 0.5) * gs.shake
        const sy = (Math.random() - 0.5) * gs.shake
        ctx.translate(sx, sy)
      }

      // Background
      drawBackground(ctx, W, H, timestamp || 0, gs.currentLevel)

      // Player bullets (laser beams)
      for (const b of gs.bullets) {
        // Laser glow
        ctx.shadowColor = '#7fdbca'
        ctx.shadowBlur = 8
        // Outer beam
        ctx.fillStyle = 'rgba(127, 219, 202, 0.3)'
        ctx.fillRect(b.x - 3, b.y - 8, 6, 16)
        // Inner beam
        ctx.fillStyle = '#7fdbca'
        ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14)
        // Core
        ctx.fillStyle = '#e0fff8'
        ctx.fillRect(b.x - 0.5, b.y - 6, 1, 12)
        ctx.shadowBlur = 0
      }

      // Enemy bullets (energy orbs)
      for (const b of gs.enemyBullets) {
        const col = b.color || '#ff4444'
        // Outer glow
        ctx.shadowColor = col
        ctx.shadowBlur = 10
        ctx.fillStyle = col + '40'
        ctx.beginPath()
        ctx.arc(b.x, b.y, 7, 0, Math.PI * 2)
        ctx.fill()
        // Inner orb
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2)
        ctx.fill()
        // Bright core
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.beginPath()
        ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // Missiles
      for (const m of gs.missiles) {
        ctx.save()
        const angle = Math.atan2(m.vy, m.vx)
        ctx.translate(m.x, m.y)
        ctx.rotate(angle + Math.PI / 2)
        // Missile body
        ctx.fillStyle = '#cc3333'
        ctx.beginPath()
        ctx.moveTo(0, -7)
        ctx.lineTo(3, -2)
        ctx.lineTo(3, 4)
        ctx.lineTo(0, 6)
        ctx.lineTo(-3, 4)
        ctx.lineTo(-3, -2)
        ctx.closePath()
        ctx.fill()
        // Nose
        ctx.fillStyle = '#ff6666'
        ctx.beginPath()
        ctx.moveTo(0, -7)
        ctx.lineTo(2, -3)
        ctx.lineTo(-2, -3)
        ctx.closePath()
        ctx.fill()
        // Trail
        ctx.fillStyle = 'rgba(255, 100, 100, 0.3)'
        ctx.beginPath()
        ctx.moveTo(-2, 6)
        ctx.lineTo(0, 12)
        ctx.lineTo(2, 6)
        ctx.fill()
        ctx.restore()
      }

      // Regular enemies
      for (const e of gs.enemies) {
        drawEnemyJet(ctx, e.x, e.y, e.color, e.isMini)
        // HP bar for tough enemies
        if (!e.isMini && e.maxHp > 1) {
          const barW = 20
          const barH = 2
          const barX = e.x - barW / 2
          const barY = e.y + (e.isMini ? 10 : 18)
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(barX, barY, barW, barH)
          ctx.fillStyle = '#3a6b1e'
          ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH)
        }
      }

      // Boss
      if (gs.boss && gs.boss.hp > 0) {
        const boss = gs.boss
        if (boss.visible) {
          drawBossJet(ctx, boss, timestamp || 0)

          // Boss HP bar below
          const barW = 50
          const barH = 4
          const barX = boss.x - barW / 2
          const barY = boss.y + 35
          // Background
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.beginPath()
          ctx.roundRect(barX, barY, barW, barH, 2)
          ctx.fill()
          // Fill
          ctx.fillStyle = boss.accentColor
          ctx.beginPath()
          ctx.roundRect(barX, barY, barW * (boss.hp / boss.maxHp), barH, 2)
          ctx.fill()
        }
      }

      // Power-ups (glowing orbs)
      for (const p of gs.powerUps) {
        const pulse = Math.sin((timestamp || 0) * 0.008) * 3
        // Outer aura
        ctx.shadowColor = p.color || '#f5b041'
        ctx.shadowBlur = 15 + pulse
        ctx.fillStyle = (p.color || '#f5b041') + '30'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 12 + pulse * 0.3, 0, Math.PI * 2)
        ctx.fill()
        // Inner orb
        const orbGrad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 9)
        orbGrad.addColorStop(0, (p.color || '#f5b041'))
        orbGrad.addColorStop(1, (p.color || '#f5b041') + '40')
        ctx.fillStyle = orbGrad
        ctx.beginPath()
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        // Icon
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.icon || '↑', p.x, p.y)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      // Particles (circles with fade)
      for (const p of gs.particles) {
        const alpha = Math.max(0, p.life)
        if (p.color && p.color.startsWith('rgba')) {
          ctx.fillStyle = p.color
        } else {
          ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, '0')
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
        ctx.fill()
      }

      // Shockwave rings
      for (const r of gs.rings) {
        const alpha = Math.max(0, r.life)
        ctx.strokeStyle = r.color + Math.round(alpha * 220).toString(16).padStart(2, '0')
        ctx.lineWidth = r.w * alpha
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Player
      if (gs.player.hp > 0) {
        drawPlayerJet(ctx, gs.player.x, gs.player.y, timestamp || 0, gs.upgrades.shield)
      }

      // Floating texts
      for (const ft of floatingTexts) {
        const alpha = Math.max(0, ft.life)
        ctx.globalAlpha = alpha
        ctx.fillStyle = ft.color
        ctx.font = '600 12px "Rajdhani", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(ft.text, ft.x, ft.y)
        ctx.textAlign = 'left'
      }
      ctx.globalAlpha = 1

      // HUD
      drawModernHUD(ctx, gs, W, H)

      // Damage flash overlay (drawn on top, not shaken)
      ctx.restore()
      if (gs.flashAlpha > 0) {
        ctx.fillStyle = 'rgba(255, 40, 40, ' + Math.min(0.6, gs.flashAlpha) + ')'
        ctx.fillRect(0, 0, W, H)
      }
    }

    // ── Game loop ──
    let lastTime = performance.now()

    function gameLoop(timestamp) {
      if (!runningRef.current) return
      lastTime = timestamp
      update(timestamp)
      draw(timestamp)
      requestAnimationFrame(gameLoop)
    }

    // Start level 1
    startLevel(1)

    setTimeout(() => {
      requestAnimationFrame(gameLoop)
    }, 2200)

    return () => { runningRef.current = false }
  }, [started, gameOver, gameWon])

  useEffect(() => {
    if (gameOver) { sfx.gameOver(); stopMusic() }
  }, [gameOver])

  useEffect(() => {
    if (started && !gameOver && !gameWon && musicOn) setMusicTempo(currentLevel)
  }, [currentLevel])

  useEffect(() => {
    if (!musicOn) { stopMusic(); return }
    if (started && !gameOver && !gameWon) { _MUSIC.bpm = 132 + (currentLevel - 1) * 11; startMusic() }
  }, [musicOn])

  function handleStart() {
    initAudio()
    if (musicOn) { _MUSIC.bpm = 132; startMusic() }
    floatingTexts = []
    setStarted(true)
  }

  function handleRestart() {
    initAudio()
    floatingTexts = []
    setScore(0)
    setHp(100)
    setGameOver(false)
    setGameWon(false)
    setCurrentLevel(1)
    setStarted(false)
    setTimeout(() => setStarted(true), 50)
  }

  return (
    <>
      <Head>
        <title>Sky Fighter ✈️</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={styles.page}>
        <div style={styles.header}>
          <a href="/" style={styles.backLink}>← News Digest</a>
          <a href="/games" style={styles.backLink}>← Arcade</a>
          <span style={styles.title}>✈️ SKY FIGHTER</span>
          <button
            onClick={() => setMusicOn(m => !m)}
            style={{
              ...styles.backLink,
              marginLeft: 'auto',
              cursor: 'pointer',
              border: '1px solid rgba(127,219,202,0.4)',
              borderRadius: 8,
              padding: '4px 12px',
              opacity: musicOn ? 1 : 0.45,
              userSelect: 'none',
            }}
            title={musicOn ? 'Mute music' : 'Unmute music'}
          >
            {musicOn ? '🎵 ON' : '🔇 OFF'}
          </button>
        </div>

        <canvas ref={canvasRef} style={styles.canvas} />

        {/* Start screen */}
        {!started && !gameOver && !gameWon && (
          <div style={styles.overlay}>
            <div style={styles.card}>
              <div style={styles.cardAccent} />
              <h2 style={styles.mainTitle}>✈️ SKY FIGHTER</h2>
              <p style={styles.desc}>Drag to fly · Auto-fire destroys enemies</p>
              <p style={styles.desc2}>5 levels · 5 unique bosses · Collect power-ups</p>
              <div style={styles.powerupList}>
                {POWER_UP_TYPES.map(pu => (
                  <span key={pu.id} style={styles.powerupBadge}>
                    {pu.icon} {pu.name}
                  </span>
                ))}
              </div>
              <button onClick={handleStart} style={styles.btn}>
                ▶ START MISSION
              </button>
            </div>
          </div>
        )}

        {/* Level intro overlay */}
        {showLevelIntro && (
          <div style={styles.overlay}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, color: '#3a86ff', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, marginBottom: 12 }}>
                LEVEL {currentLevel}
              </div>
              <div style={{ fontSize: 22, color: '#ff6b6b', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, marginBottom: 12 }}>
                ⚠️ {levelIntroBoss} ⚠️
              </div>
              <div style={{ fontSize: 14, color: '#a0b0d0', fontFamily: "'Rajdhani', sans-serif", maxWidth: 360, lineHeight: 1.8 }}>
                {levelIntroText}
              </div>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameOver && (
          <div style={styles.overlay}>
            <div style={{ ...styles.card, ...styles.cardGameOver }}>
              <div style={styles.cardAccentRed} />
              <h2 style={{ fontSize: 24, color: '#c0552d', margin: '0 0 16px', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>
                MISSION FAILED
              </h2>
              <div style={styles.statLine}>SCORE: {score}</div>
              <div style={styles.statLine2}>REACHED LEVEL: {currentLevel}</div>
              <button onClick={handleRestart} style={{ ...styles.btn, borderColor: '#c0552d' }}>RETRY</button>
            </div>
          </div>
        )}

        {/* Game won */}
        {gameWon && (
          <div style={styles.overlay}>
            <div style={{ ...styles.card, ...styles.cardVictory }}>
              <div style={styles.cardAccentGold} />
              <h2 style={{ fontSize: 24, color: '#f5b041', margin: '0 0 16px', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>
                🏆 MISSION COMPLETE
              </h2>
              <div style={styles.statLine}>FINAL SCORE: {score}</div>
              <div style={styles.statLine2}>ALL 5 BOSSES DESTROYED</div>
              <div style={{ fontSize: 14, color: '#7fdbca', margin: '12px 0', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}>
                YOU ARE THE SKY FIGHTER!
              </div>
              <button onClick={handleRestart} style={{ ...styles.btn, borderColor: '#f5b041' }}>PLAY AGAIN</button>
            </div>
          </div>
        )}

        <div style={styles.footer}>
          Drag to move · Auto-fire · 5 Levels · 5 Bosses
        </div>
      </div>
    </>
  )
}

// ─── Modern HUD Drawing ─────────────────────────────────────────
function drawModernHUD(ctx, gs, W, H) {
  // Semi-transparent top bar
  const barGrad = ctx.createLinearGradient(0, 0, 0, 44)
  barGrad.addColorStop(0, 'rgba(0, 0, 0, 0.6)')
  barGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = barGrad
  ctx.fillRect(0, 0, W, 44)

  // Score
  ctx.fillStyle = '#e0e8ff'
  ctx.font = '700 16px "Rajdhani", sans-serif'
  ctx.fillText(`${gs.score}`, 12, 22)

  // Level badge
  const lvlX = W - 60
  ctx.fillStyle = 'rgba(58, 134, 255, 0.3)'
  ctx.beginPath()
  ctx.roundRect(lvlX - 4, 6, 56, 20, 4)
  ctx.fill()
  ctx.fillStyle = '#3a86ff'
  ctx.font = '700 12px "Rajdhani", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`LV ${gs.currentLevel}`, lvlX + 24, 20)
  ctx.textAlign = 'left'

  // HP bar
  const hpBarW = W - 24
  const hpBarH = 5
  const hpY = 30
  // Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.beginPath()
  ctx.roundRect(12, hpY, hpBarW, hpBarH, 2.5)
  ctx.fill()
  // Fill
  const hpRatio = gs.player.hp / gs.player.maxHp
  const hpColor = hpRatio > 0.5 ? '#3a6b1e' : hpRatio > 0.25 ? '#c8a951' : '#c0552d'
  ctx.fillStyle = hpColor
  ctx.beginPath()
  ctx.roundRect(12, hpY, hpBarW * hpRatio, hpBarH, 2.5)
  ctx.fill()
  // HP text
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '600 9px "Rajdhani", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.max(0, Math.round(gs.player.hp))} HP`, W / 2, hpY + 4.5)
  ctx.textAlign = 'left'

  // Combo indicator
  if (gs.combo > 1) {
    ctx.fillStyle = '#f5b041'
    ctx.font = '700 11px "Rajdhani", sans-serif'
    ctx.fillText(`x${gs.combo} COMBO`, 12, hpY + 18)
  }

  // Boss HP bar
  if (gs.boss && gs.boss.hp > 0) {
    const bossBarW = W - 60
    const bossBarH = 5
    const bossY = 50
    // Boss name
    ctx.fillStyle = gs.boss.accentColor || '#ff6b6b'
    ctx.font = '700 10px "Rajdhani", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(gs.boss.name, W / 2, bossY - 2)
    // Bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.beginPath()
    ctx.roundRect(30, bossY + 2, bossBarW, bossBarH, 2.5)
    ctx.fill()
    // Bar fill
    const bossRatio = gs.boss.hp / gs.boss.maxHp
    ctx.fillStyle = gs.boss.color || '#c0552d'
    ctx.beginPath()
    ctx.roundRect(30, bossY + 2, bossBarW * bossRatio, bossBarH, 2.5)
    ctx.fill()
    ctx.textAlign = 'left'
  }

  // Progress indicator
  if (!gs.boss || gs.boss.hp <= 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '600 10px "Rajdhani", sans-serif'
    ctx.fillText(`ENEMIES: ${Math.max(0, gs.enemiesRemaining)}`, 12, H - 8)
  }
}

// ─── Styles ─────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0e1a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Rajdhani', sans-serif",
    color: '#e0e8ff',
  },
  header: {
    width: 'min(480px, 100%)',
    padding: '12px 16px',
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backLink: {
    color: '#6b7db3',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Rajdhani', sans-serif",
  },
  title: {
    color: '#3a86ff',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "'Rajdhani', sans-serif",
  },
  canvas: {
    display: 'block',
    maxWidth: 'min(480px, calc(100vw - 40px))',
    border: '1px solid rgba(58, 134, 255, 0.2)',
    borderRadius: 8,
  },
  footer: {
    marginTop: 16,
    fontSize: 12,
    color: '#3a4a6a',
    fontFamily: "'Rajdhani', sans-serif",
    textAlign: 'center',
    padding: '0 16px',
    fontWeight: 600,
  },
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(6, 10, 20, 0.92)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    background: 'linear-gradient(135deg, #141a2e 0%, #1a2040 100%)',
    borderRadius: 16,
    padding: '32px 24px',
    textAlign: 'center',
    maxWidth: 400,
    width: '90%',
    border: '1px solid rgba(58, 134, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    background: 'linear-gradient(90deg, #3a86ff, #7fdbca, #3a86ff)',
  },
  cardAccentRed: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    background: 'linear-gradient(90deg, #c0552d, #ff4444, #c0552d)',
  },
  cardAccentGold: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    background: 'linear-gradient(90deg, #f5b041, #ffd700, #f5b041)',
  },
  cardGameOver: {
    borderColor: 'rgba(192, 85, 45, 0.3)',
  },
  cardVictory: {
    borderColor: 'rgba(245, 176, 65, 0.3)',
  },
  mainTitle: {
    fontSize: 28,
    color: '#e0e8ff',
    margin: '0 0 16px',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    letterSpacing: 2,
  },
  desc: {
    fontSize: 14,
    color: '#7fdbca',
    margin: '8px 0',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 600,
  },
  desc2: {
    fontSize: 14,
    color: '#f5b041',
    margin: '8px 0',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 600,
  },
  powerupList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    margin: '16px 0',
  },
  powerupBadge: {
    fontSize: 11,
    color: '#a0b0d0',
    background: 'rgba(15, 26, 58, 0.8)',
    padding: '5px 10px',
    borderRadius: 6,
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 600,
    border: '1px solid rgba(58, 134, 255, 0.15)',
  },
  btn: {
    marginTop: 20,
    padding: '14px 40px',
    borderRadius: 10,
    border: '1px solid #3a86ff',
    background: 'linear-gradient(180deg, #1a2a50 0%, #0f1a3a 100%)',
    color: '#e0e8ff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Rajdhani', sans-serif",
    letterSpacing: 1,
    boxShadow: '0 4px 16px rgba(58, 134, 255, 0.2)',
  },
  statLine: {
    fontSize: 18,
    color: '#e0e8ff',
    margin: '8px 0',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
  },
  statLine2: {
    fontSize: 14,
    color: '#6b7db3',
    margin: '8px 0',
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 600,
  },
}
