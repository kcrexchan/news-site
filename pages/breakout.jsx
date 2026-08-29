import React, { useRef, useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

// ── Brick types: name printed on the brick, HP = hits needed ─────────────────
// Higher HP bricks drop power-ups more often.
const BRICK_TYPES = [
  { id: 'lisa', name: 'LISA', hp: 1, color: '#2ecc71', drop: 0.05 },
  { id: 'rex',  name: 'REX',  hp: 2, color: '#e67e22', drop: 0.10 },
  { id: 'cory', name: 'CORY', hp: 3, color: '#3498db', drop: 0.15 },
  { id: 'nic',  name: 'NIC',  hp: 4, color: '#9b59b6', drop: 0.20 },
]
const BT = {}
BRICK_TYPES.forEach(b => { BT[b.id] = b })

// ── Power-ups ─────────────────────────────────────────────────────────────────
const POWERUPS = {
  W: { color: '#f1c40f', label: 'W' },
  B: { color: '#ecfccb', label: 'B' },
  F: { color: '#00e5ff', label: 'F' },
  S: { color: '#ff5252', label: 'S' },
}
const PU_KEYS = ['W', 'B', 'F', 'S']
const FAST_MULT = 1.2
const FAST_COLOR = '#00e5ff'
const WIDE_HITS = 15
const SHOOT_TIME = 10
const SHOOT_COOLDOWN = 0.5
const BULLET_SPEED = 12
const PU_FALL = 2.2
// ── Sound: Web Audio API, fully synthesized (no asset files needed) ─────────
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { audioCtx = null }
  }
  if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume() } catch (e) {} }
  return audioCtx
}
function tone(freq, dur, type, vol, delay) {
  const ctx = audioCtx; if (!ctx) return
  const t0 = ctx.currentTime + (delay || 0)
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.type = type || 'sine'; osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ctx.destination); osc.start(t0); osc.stop(t0 + dur + 0.02)
}
function blip(toFreq, fromFreq, dur, type, vol) {
  const ctx = audioCtx; if (!ctx) return
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator(), g = ctx.createGain()
  osc.type = type || 'square'; osc.frequency.setValueAtTime(fromFreq, t0)
  osc.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ctx.destination); osc.start(t0); osc.stop(t0 + dur + 0.02)
}
function arp(freqs, type, vol, perDur, gap) { for (let i = 0; i < freqs.length; i++) tone(freqs[i], perDur, type, vol, i * gap) }
function soundPaddle() { blip(330, 200, 0.08, 'square', 0.12) }
function soundWall()    { tone(160, 0.05, 'sine', 0.06) }
function soundLaunch()  { blip(820, 300, 0.16, 'triangle', 0.12) }
function soundBrick(br) { const map = { 1: 440, 2: 523, 3: 659, 4: 784 }; tone(map[br.hp] || 440, 0.09, 'square', 0.13) }
function soundPowerUp() { arp([523, 784], 'triangle', 0.16, 0.12, 0.08) }
function soundLoseLife(){ blip(140, 520, 0.4, 'sawtooth', 0.18) }
function soundLevelComplete() { arp([392, 494, 587, 784], 'square', 0.15, 0.13, 0.1) }
function soundWin()     { arp([523, 659, 784, 1047, 784, 1047], 'square', 0.17, 0.15, 0.12) }
function soundGameOver(){ arp([400, 320, 250, 180], 'sawtooth', 0.18, 0.22, 0.14) }


// ── Levels (full walls, tougher mix per level) ────────────────────────────────
const LEVELS = {
  1: { speed: 4, paddleColor: '#6b9e4a', ballColor: '#ecfccb', bg: '#0f1a0f', hudColor: '#a7c4a0', subColor: '#7a8f6e',
       weights: { lisa: 40, rex: 30, cory: 20, nic: 10 } },
  2: { speed: 4.5, paddleColor: '#2980b9', ballColor: '#d6eaf8', bg: '#0a1628', hudColor: '#85c1e9', subColor: '#5dade2',
       weights: { lisa: 30, rex: 30, cory: 25, nic: 15 } },
  3: { speed: 5, paddleColor: '#d4432e', ballColor: '#fdebd0', bg: '#1a0a0a', hudColor: '#f5b041', subColor: '#e67e22',
       weights: { lisa: 20, rex: 30, cory: 30, nic: 20 } },
  4: { speed: 5.5, paddleColor: '#8e44ad', ballColor: '#f5eef8', bg: '#0a0a1a', hudColor: '#bb8fce', subColor: '#a569bd',
       weights: { lisa: 15, rex: 25, cory: 30, nic: 30 } },
}
const MAX_LEVEL = 4
const LEVEL_BTN_COLORS = ['#6b9e4a', '#2980b9', '#d4432e', '#8e44ad']
const ROWS = 8, COLS = 10

function pickType(w) {
  const total = w.lisa + w.rex + w.cory + w.nic
  let r = Math.random() * total
  for (const id of ['lisa', 'rex', 'cory', 'nic']) {
    r -= w[id]
    if (r < 0) return id
  }
  return 'lisa'
}

export default function Breakout() {
  const router = useRouter()
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [level, setLevel] = useState(1)
  const [runId, setRunId] = useState(0)

  const scoreRef = useRef(0)
  const restartRef = useRef(null)

  restartRef.current = () => {
    scoreRef.current = 0
    setScore(0)
    setLives(3)
    setGameOver(false)
    setWon(false)
    setLevel(1)
    setRunId((id) => id + 1)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (typeof ctx.roundRect !== 'function') {
      ctx.roundRect = function (x, y, w, h, r) {
        const rr = (typeof r === 'number' ? [r, r, r, r] : [r, r, r, r])
        this.moveTo(x + rr[0], y)
        this.lineTo(x + w - rr[1], y); this.arcTo(x + w, y, x + w, y + rr[1], rr[1])
        this.lineTo(x + w, y + h - rr[2]); this.arcTo(x + w, y + h, x + w - rr[2], y + h, rr[2])
        this.lineTo(x + rr[3], y + h); this.arcTo(x, y + h, x, y + h - rr[3], rr[3])
        this.lineTo(x, y + rr[0]); this.arcTo(x, y, x + rr[0], y, rr[0])
        this.closePath()
      }
    }

    const W = Math.min(800, window.innerWidth - 40)
    const H = 600
    canvas.width = W
    canvas.height = H

    const lvl = level || 1
    const cfg = LEVELS[lvl] || LEVELS[1]

    if (lvl === 1) scoreRef.current = 0

    // ── Game state ───────────────────────────────────────────────────────────
    const paddleBaseW = Math.max(100, W * 0.2)
    let paddleW = paddleBaseW
    const paddleH = 14
    let paddleX = (W - paddleW) / 2
    let wideHits = 0, shootTimer = 0, lastShot = 0

    const newBall = (x, y, vx, vy, color) => ({ x, y, vx, vy, r: 8, color, stuck: false })
    let balls = [newBall(W / 2, H - 40, cfg.speed * (Math.random() > 0.5 ? 1 : -1), -cfg.speed, cfg.ballColor)]
    balls[0].stuck = true
    let bullets = []
    let powerups = []

    // Bricks
    const brickW = Math.max(24, W / COLS - 8)
    const brickH = 24
    const brickPad = 4
    const bricks = []
    for (let r = 0; r < ROWS; r++) {
      bricks[r] = []
      for (let c = 0; c < COLS; c++) {
        const t = BT[pickType(cfg.weights)]
        bricks[r][c] = {
          x: c * (brickW + brickPad) + (W - COLS * (brickW + brickPad) + brickPad) / 2,
          y: r * (brickH + brickPad) + 56,
          w: brickW, h: brickH,
          type: t, hp: t.hp, alive: true,
        }
      }
    }

    let lives_ = 3
    let phase = 'playing'
    let running = true
    let animId = 0
    let levelTimeout = 0
    let mouseX = null

    const addScore = (pts) => {
      scoreRef.current += pts
      setScore(scoreRef.current)
    }

    // ── Input ────────────────────────────────────────────────────────────────
    const keysDown = {}
    function launchOrShoot() {
      if (phase === 'over' || phase === 'won') { restartRef.current(); return }
      if (phase !== 'playing') return
      const now = performance.now() / 1000
      if (balls.some(b => b.stuck)) {
        for (const b of balls) {
          if (b.stuck) {
            b.stuck = false
            const sp = Math.hypot(b.vx, b.vy) || cfg.speed
            b.vx = sp * (Math.random() > 0.5 ? 1 : -1)
            b.vy = -sp
          }
        }
        ensureAudio()
        soundLaunch()
        return
      }
      if (shootTimer > 0 && now - lastShot >= SHOOT_COOLDOWN) {
        lastShot = now
        bullets.push({ x: paddleX + paddleW / 2, y: H - paddleH - 14, r: 3 })
      }
    }
    const onKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
      if (e.key === ' ') { launchOrShoot(); return }
      keysDown[e.key] = true
    }
    const onKeyUp = (e) => { keysDown[e.key] = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const toCanvasX = (clientX) => {
      const rect = canvas.getBoundingClientRect()
      return (clientX - rect.left) * (canvas.width / rect.width)
    }
    const onMouseMove = (e) => { mouseX = toCanvasX(e.clientX) }
    const onTouchMove = (e) => { e.preventDefault(); mouseX = toCanvasX(e.touches[0].clientX) }
    const onMouseDown = () => launchOrShoot()
    const onTouchStart = (e) => launchOrShoot()
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })

    // ── Power-up logic ───────────────────────────────────────────────────────
    function maybeDrop(b) {
      if (Math.random() < b.type.drop) {
        const k = PU_KEYS[Math.floor(Math.random() * PU_KEYS.length)]
        powerups.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, k, r: 11 })
      }
    }
    function applyPower(k) {
      scoreRef.current += 50; setScore(scoreRef.current)
      if (k === 'W') {
        wideHits = WIDE_HITS
      } else if (k === 'B') {
        const src = balls[0]
        if (src) balls.push(newBall(src.x, src.y, src.vx, src.vy, src.color))
      } else if (k === 'F') {
        const src = balls[0]
        const baseSpeed = cfg.speed * FAST_MULT
        const angle = Math.atan2(src.vy, src.vx)
        const fb = newBall(src.x, src.y, baseSpeed * Math.cos(angle), baseSpeed * Math.sin(angle), FAST_COLOR)
        fb.fast = true
        balls.push(fb)
      } else if (k === 'S') {
        shootTimer = SHOOT_TIME
        lastShot = 0
      }
    }

    // ── Drawing ──────────────────────────────────────────────────────────────
    function drawPaddle() {
      ctx.fillStyle = cfg.paddleColor
      ctx.shadowColor = cfg.paddleColor + '80'
      ctx.shadowBlur = 12
      const r = paddleH / 2
      ctx.beginPath()
      ctx.roundRect(paddleX, H - paddleH - 6, paddleW, paddleH, r)
      ctx.fill()
      ctx.shadowBlur = 0
      if (shootTimer > 0) {
        ctx.fillStyle = POWERUPS.S.color
        ctx.beginPath()
        ctx.roundRect(paddleX + paddleW / 2 - 4, H - paddleH - 18, 8, 10, 2)
        ctx.fill()
      }
    }
    function drawBall(b) {
      ctx.fillStyle = b.color
      ctx.shadowColor = b.color + '90'
      ctx.shadowBlur = b.fast ? 22 : 15
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
    function drawBricks() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const b = bricks[r][c]
          if (!b.alive) continue
          const col = b.type.color
          ctx.fillStyle = col
          ctx.shadowColor = col + '60'
          ctx.shadowBlur = 4
          ctx.beginPath()
          ctx.roundRect(b.x, b.y, b.w, b.h, 3)
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.fillStyle = 'rgba(10,10,10,0.85)'
          ctx.font = 'bold 11px Inter, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(b.type.name, b.x + b.w / 2, b.y + b.h / 2 + 4)
          if (b.hp > 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)'
            const pw = 5, gap = 2
            const totalW = b.hp * pw + (b.hp - 1) * gap
            for (let i = 0; i < b.hp; i++) {
              ctx.fillRect(b.x + b.w / 2 - totalW / 2 + i * (pw + gap), b.y + b.h - 6, pw, 3)
            }
          }
          ctx.textAlign = 'left'
        }
      }
    }
    function drawBullets() {
      ctx.fillStyle = POWERUPS.S.color
      ctx.shadowColor = POWERUPS.S.color
      ctx.shadowBlur = 8
      for (const bl of bullets) {
        ctx.beginPath()
        ctx.roundRect(bl.x - 2, bl.y - 7, 4, 12, 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }
    function drawPowerups() {
      for (const p of powerups) {
        const def = POWERUPS[p.k]
        ctx.fillStyle = def.color
        ctx.shadowColor = def.color
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.roundRect(p.x - p.r, p.y - p.r * 0.62, p.r * 2, p.r * 1.24, 5)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = '#101010'
        ctx.font = 'bold 12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(def.label, p.x, p.y + 4)
        ctx.textAlign = 'left'
      }
    }
    function bricksLeft() {
      let n = 0
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (bricks[r][c].alive) n++
      return n
    }
    function drawHUD() {
      ctx.fillStyle = cfg.hudColor
      ctx.font = '16px Inter, sans-serif'
      ctx.fillText('Lvl ' + lvl + ' · Score: ' + scoreRef.current, 12, 26)
      for (let i = 0; i < lives_; i++) {
        const lx = W - 40 + i * 22
        ctx.fillStyle = cfg.ballColor
        ctx.beginPath()
        ctx.arc(lx, 18, 6, 0, Math.PI * 2)
        ctx.fill()
      }
      let ix = 12
      ctx.font = 'bold 13px Inter, sans-serif'
      if (wideHits > 0) { ctx.fillStyle = POWERUPS.W.color; ctx.fillText('W ' + wideHits, ix, 46); ix += 64 }
      if (shootTimer > 0) { ctx.fillStyle = POWERUPS.S.color; ctx.fillText('S ' + Math.ceil(shootTimer) + 's', ix, 46); ix += 64 }
      const fastCount = balls.filter(b => b.fast).length
      if (fastCount > 0) { ctx.fillStyle = POWERUPS.F.color; ctx.fillText('F ×' + fastCount, ix, 46) }
      ctx.font = '11px Inter, sans-serif'
      ctx.fillStyle = cfg.subColor
      let legend = 'LISA 1 hit'
      for (const t of ['rex', 'cory', 'nic']) legend += '  ·  ' + BT[t].name + ' ' + BT[t].hp + ' hits'
      ctx.textAlign = 'center'
      ctx.fillText(legend, W / 2, H - 10)
      ctx.textAlign = 'left'
    }
    function drawOverlay(text, sub) {
      ctx.fillStyle = cfg.bg + 'cc'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = cfg.ballColor
      ctx.font = 'bold 36px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(text, W / 2, H / 2 - 10)
      ctx.fillStyle = cfg.hudColor
      ctx.font = '18px Inter, sans-serif'
      ctx.fillText(sub || 'Press Space to restart', W / 2, H / 2 + 30)
      ctx.textAlign = 'left'
    }

    // ── Main loop ────────────────────────────────────────────────────────────
    function loop() {
      if (!running) return
      const now = performance.now() / 1000

      ctx.fillStyle = cfg.bg
      ctx.fillRect(0, 0, W, H)

      let targetX = paddleX
      if (keysDown['ArrowRight']) targetX = paddleX + 18
      else if (keysDown['ArrowLeft']) targetX = paddleX - 18
      else if (mouseX !== null) targetX = mouseX - paddleW / 2
      paddleX += (targetX - paddleX) * 0.45
      paddleX = Math.max(0, Math.min(W - paddleW, paddleX))

      const targetW = wideHits > 0 ? paddleBaseW * 1.5 : paddleBaseW
      paddleW += (targetW - paddleW) * 0.2
      if (Math.abs(paddleW - targetW) < 0.5) paddleW = targetW

      if (shootTimer > 0) shootTimer = Math.max(0, shootTimer - 1 / 60)

      // Auto-fire bullets while S power-up is active — no tap needed
      if (shootTimer > 0 && now - lastShot >= SHOOT_COOLDOWN) {
        lastShot = now
        bullets.push({ x: paddleX + paddleW / 2, y: H - paddleH - 14, r: 3 })
      }

      const paddleTop = H - paddleH - 6
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]
        if (b.stuck) {
          b.x = paddleX + paddleW / 2
          b.y = paddleTop - b.r
          continue
        }
        // Advance in small substeps so a fast ball can't tunnel through thin bricks.
        const dist = Math.hypot(b.vx, b.vy)
        let steps = Math.max(1, Math.ceil(dist / (b.r * 0.5)))
        for (let s = 0; s < steps; s++) {
          const svx = b.vx / steps, svy = b.vy / steps
          b.x += svx
          b.y += svy

          if (b.x + b.r > W || b.x - b.r < 0) { b.vx = -b.vx; b.x = Math.max(b.r, Math.min(W - b.r, b.x)); soundWall() }
          if (b.y - b.r < 0) { b.vy = -b.vy; soundWall() }

          if (b.y + b.r > paddleTop && b.y + b.r < paddleTop + paddleH + 10 &&
              b.x > paddleX && b.x < paddleX + paddleW && b.vy > 0) {
            soundPaddle()
            const hitPos = (b.x - paddleX) / paddleW
            const angle = (hitPos - 0.5) * Math.PI * 0.7
            const speed = Math.hypot(b.vx, b.vy)
            b.vy = -Math.abs(speed * Math.cos(angle))
            b.vx = speed * Math.sin(angle)
            b.y = paddleTop - b.r
            if (speed < 10) { const f = 1.02; b.vx *= f; b.vy *= f }
          }

          let hitBrick = false
          for (let r = 0; r < ROWS && !hitBrick; r++) {
          for (let c = 0; c < COLS; c++) {
            const br = bricks[r][c]
            if (!br.alive) continue
            const closestX = Math.max(br.x, Math.min(b.x, br.x + br.w))
            const closestY = Math.max(br.y, Math.min(b.y, br.y + br.h))
            const ddx = b.x - closestX, ddy = b.y - closestY
            if (ddx * ddx + ddy * ddy < b.r * b.r) {
              // F (fast) ball: destroys every brick it passes through
              soundBrick(br)
              const dmg = b.fast ? 2 : 1
              br.hp -= dmg
              if (wideHits > 0) wideHits--
              if (br.hp <= 0) {
                br.alive = false
                scoreRef.current += 10; setScore(scoreRef.current)
                maybeDrop(br)
              } else {
                scoreRef.current += 5; setScore(scoreRef.current)
              }
              const overlapLeft = b.x + b.r - br.x
              const overlapRight = br.x + br.w - (b.x - b.r)
              const overlapTop = b.y + b.r - br.y
              const overlapBottom = br.y + br.h - (b.y - b.r)
              if (Math.min(overlapLeft, overlapRight) < Math.min(overlapTop, overlapBottom)) b.vx = -b.vx
              else b.vy = -b.vy
              hitBrick = true
              break
            }
          }
        }
      }

        if (b.y - b.r > H + 20) {
          balls.splice(i, 1)
          if (balls.length === 0) {
            lives_--
            setLives(lives_)
            soundLoseLife()
            if (lives_ <= 0) {
              phase = 'over'
              running = false
              soundGameOver()
              setGameOver(true)
              drawPaddle(); drawBricks(); drawHUD()
              drawOverlay('Game Over', 'Final Score: ' + scoreRef.current + ' · Press Space or Play Again to restart')
              return
            }
            balls.push(newBall(paddleX + paddleW / 2, paddleTop - 8, cfg.speed * (Math.random() > 0.5 ? 1 : -1), -cfg.speed, cfg.ballColor))
            balls[0].stuck = true
          }
        }
      }

      for (let i = bullets.length - 1; i >= 0; i--) {
        const bl = bullets[i]
        bl.y -= BULLET_SPEED
        if (bl.x - bl.r < 0) bl.x = bl.r
        if (bl.x + bl.r > W) bl.x = W - bl.r
        let dead = bl.y < -10
        if (!dead) {
          for (let r = 0; r < ROWS && !dead; r++) {
            for (let c = 0; c < COLS; c++) {
              const br = bricks[r][c]
              if (!br.alive) continue
              if (bl.x + bl.r > br.x && bl.x - bl.r < br.x + br.w &&
                  bl.y + bl.r > br.y && bl.y - bl.r < br.y + br.h) {
                soundBrick(br)
                br.hp -= 1
                if (wideHits > 0) wideHits--
                if (br.hp <= 0) {
                  br.alive = false
                  scoreRef.current += 10; setScore(scoreRef.current)
                  maybeDrop(br)
                } else {
                  scoreRef.current += 5; setScore(scoreRef.current)
                }
                dead = true
                break
              }
            }
          }
        }
        if (dead) bullets.splice(i, 1)
      }

      for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i]
        p.y += PU_FALL
        if (p.y - p.r > H + 10) { powerups.splice(i, 1); continue }
        if (p.y + p.r > paddleTop && p.y - p.r < paddleTop + paddleH + 8 &&
            p.x > paddleX - 4 && p.x < paddleX + paddleW + 4) {
          soundPowerUp()
          applyPower(p.k)
          powerups.splice(i, 1)
        }
      }

      if (phase === 'playing' && bricksLeft() === 0) {
        running = false
        if (lvl < MAX_LEVEL) {
          phase = 'levelup'
          drawPaddle(); drawBricks(); drawHUD()
          soundLevelComplete()
          drawOverlay('Level ' + lvl + ' Complete! 🎉', 'Next: Level ' + (lvl + 1) + ' · Score: ' + scoreRef.current)
          levelTimeout = setTimeout(() => setLevel(lvl + 1), 2500)
        } else {
          phase = 'won'
          setWon(true)
          drawPaddle(); drawBricks(); drawHUD()
          soundWin()
          drawOverlay('You Win! 🏆', 'All 4 levels cleared · Final Score: ' + scoreRef.current)
        }
        return
      }

      drawBullets()
      drawPowerups()
      for (const b of balls) drawBall(b)
      drawPaddle()
      drawBricks()
      drawHUD()

      animId = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      running = false
      cancelAnimationFrame(animId)
      clearTimeout(levelTimeout)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('touchstart', onTouchStart)
    }
  }, [level, runId])

  return (
    <>
      <Head>
        <title>Breakout 🌿</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0f1a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: '#ecfccb' }}>
        <div style={{ width: 'min(800px, 100%)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(167,139,108,0.15)' }}>
          <button onClick={() => router.back()} style={{ color: '#a7c4a0', background: 'none', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Back</button>
          <span style={{ fontSize: 13, color: '#7a8f6e' }}>Move: arrows / mouse · Launch: Space · Shoot: Space (when S active)</span>
        </div>

        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: 'min(800px, calc(100vw - 40px))', touchAction: 'none' }} />

        {(gameOver || won) && (
          <button onClick={() => restartRef.current()} style={{
            marginTop: 20, padding: '12px 36px', borderRadius: 8, border: 'none',
            background: LEVEL_BTN_COLORS[Math.min(level, MAX_LEVEL) - 1],
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>Play Again</button>
        )}

        <div style={{ marginTop: 24, fontSize: 12, color: '#5a6e5a' }}>Breakout · 4 Levels · W/B/F/S power-ups · Space to launch or shoot</div>
      </div>
    </>
  )
}
