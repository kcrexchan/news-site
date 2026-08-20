import React, { useRef, useEffect, useState } from 'react'
import Head from 'next/head'

// Classic Breakout levels — full brick walls, harder each level.
// '.' = gap, 1-9 = brick HP. Row colors follow the original Atari palette.
const LEVELS = {
  1: {
    speed: 4, paddleColor: '#6b9e4a', ballColor: '#ecfccb', bg: '#0f1a0f', hudColor: '#a7c4a0', subColor: '#7a8f6e',
    colors: ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e8c'],
    pattern: [
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
    ],
  },
  2: {
    speed: 4.5, paddleColor: '#2980b9', ballColor: '#d6eaf8', bg: '#0a1628', hudColor: '#85c1e9', subColor: '#5dade2',
    colors: ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e8c'],
    pattern: [
      '2222222222',
      '2222222222',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
      '1111111111',
    ],
  },
  3: {
    speed: 5, paddleColor: '#d4432e', ballColor: '#fdebd0', bg: '#1a0a0a', hudColor: '#f5b041', subColor: '#e67e22',
    colors: ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e8c','#f5b041','#7f8c8d'],
    pattern: [
      '222222222222',
      '222222222222',
      '111111111111',
      '111111111111',
      '111111111111',
      '111111111111',
      '111111111111',
      '111111111111',
      '111111111111',
      '111111111111',
    ],
  },
  4: {
    speed: 5.5, paddleColor: '#8e44ad', ballColor: '#f5eef8', bg: '#0a0a1a', hudColor: '#bb8fce', subColor: '#a569bd',
    colors: ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e8c','#f5b041','#7f8c8d'],
    pattern: [
      '333333333333',
      '1.1.1.1.1.1.1.',
      '111111111111',
      '1.1.1.1.1.1.1.',
      '111111111111',
      '1.1.1.1.1.1.1.',
      '111111111111',
      '1.1.1.1.1.1.1.',
      '111111111111',
      '1.1.1.1.1.1.1.',
    ],
  },
}

const MAX_LEVEL = 4
const LEVEL_BTN_COLORS = ['#6b9e4a','#2980b9','#d4432e','#8e44ad']

export default function Breakout() {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [level, setLevel] = useState(1)
  const [runId, setRunId] = useState(0)

  // Persisted across level-up effect re-runs (score is cumulative; resets on new game)
  const scoreRef = useRef(0)
  const restartRef = useRef(null)

  // Stable restart — safe to call from inside the game loop / key handlers
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

    // Fallback for older browsers without ctx.roundRect
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

    // Responsive sizing (internal coord space fixed; CSS scales the element)
    const W = Math.min(800, window.innerWidth - 40)
    const H = 600
    canvas.width = W
    canvas.height = H

    const lvl = level || 1
    const cfg = LEVELS[lvl] || LEVELS[1]

    // New game (level 1) resets the cumulative score
    if (lvl === 1) scoreRef.current = 0

    // Game objects
    const paddleW = Math.max(100, W * 0.2)
    const paddleH = 14
    let paddleX = (W - paddleW) / 2

    const ballR = 8
    let ballX = W / 2
    let ballY = H - paddleH - 30
    let dx = cfg.speed * (Math.random() > 0.5 ? 1 : -1)
    let dy = -cfg.speed

    // Bricks — built from the level's pattern ('.'/'0' = gap, 1-9 = HP)
    const brickRows = cfg.pattern.length
    const brickCols = Math.max(1, cfg.pattern[0].replace(/\s/g, '').length)
    const brickW = Math.max(24, W / brickCols - 8)
    const brickH = 24
    const brickPad = 4
    const bricks = []
    const rowColors = cfg.colors

    for (let r = 0; r < brickRows; r++) {
      bricks[r] = []
      const rowStr = (cfg.pattern[r] || '').replace(/\s/g, '')
      for (let c = 0; c < brickCols; c++) {
        const ch = rowStr[c] !== undefined ? rowStr[c] : '.'
        const hp = parseInt(ch, 10)
        if (isNaN(hp) || hp <= 0) {
          bricks[r][c] = { alive: false, hp: 0 }
        } else {
          bricks[r][c] = { x: c * (brickW + brickPad) + 4, y: r * (brickH + brickPad) + 60, alive: true, hp }
        }
      }
    }

    let lives_ = 3
    let phase = 'playing' // playing | levelup | over | won
    let running = true
    let animId = 0
    let levelTimeout = 0

    const addScore = (pts) => {
      scoreRef.current += pts
      setScore(scoreRef.current)
    }

    // Input — keyboard
    const keysDown = {}
    const onKeyDown = (e) => {
      if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
      if (e.key === ' ' && (phase === 'over' || phase === 'won')) {
        restartRef.current()
        return
      }
      keysDown[e.key] = true
    }
    const onKeyUp = (e) => { keysDown[e.key] = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // Input — mouse/touch (scale CSS pixels into canvas coord space)
    let mouseX = null
    const toCanvasX = (clientX) => {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      return (clientX - rect.left) * scaleX
    }
    const onMouseMove = (e) => { mouseX = toCanvasX(e.clientX) }
    const onTouchMove = (e) => {
      e.preventDefault()
      mouseX = toCanvasX(e.touches[0].clientX)
    }
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })

    // Drawing
    function drawPaddle() {
      ctx.fillStyle = cfg.paddleColor
      ctx.shadowColor = cfg.paddleColor + '80'
      ctx.shadowBlur = 12
      const r = paddleH / 2
      ctx.beginPath()
      ctx.roundRect(paddleX, H - paddleH - 6, paddleW, paddleH, r)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    function drawBall() {
      ctx.fillStyle = cfg.ballColor
      ctx.shadowColor = cfg.ballColor + '90'
      ctx.shadowBlur = 15
      ctx.beginPath()
      ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    function drawBricks() {
      for (let r = 0; r < brickRows; r++) {
        for (let c = 0; c < brickCols; c++) {
          const b = bricks[r][c]
          if (!b.alive) continue
          ctx.fillStyle = rowColors[r % rowColors.length]
          ctx.shadowColor = rowColors[r % rowColors.length] + '60'
          ctx.shadowBlur = 4
          ctx.beginPath()
          ctx.roundRect(b.x, b.y, brickW, brickH, 3)
          ctx.fill()
          if (b.hp > 1) {
            ctx.shadowBlur = 0
            ctx.fillStyle = 'rgba(255,255,255,0.8)'
            ctx.font = 'bold 11px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(b.hp, b.x + brickW / 2, b.y + brickH / 2 + 4)
            ctx.textAlign = 'left'
          }
        }
      }
      ctx.shadowBlur = 0
    }

    function bricksLeft() {
      let total = 0
      for (let r = 0; r < brickRows; r++)
        for (let c = 0; c < brickCols; c++)
          if (bricks[r][c].alive) total++
      return total
    }

    function drawHUD() {
      ctx.fillStyle = cfg.hudColor
      ctx.font = '16px Inter, sans-serif'
      ctx.fillText(`Lvl ${lvl} · Score: ${scoreRef.current}`, 12, 30)

      for (let i = 0; i < lives_; i++) {
        const lx = W - 40 + i * 22
        ctx.fillStyle = cfg.ballColor
        ctx.beginPath()
        ctx.arc(lx, 18, 6, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.fillStyle = cfg.subColor
      ctx.font = '12px Inter, sans-serif'
      ctx.fillText(`${bricksLeft()} bricks left`, W / 2 - 30, H - 14)
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

    function loop() {
      if (!running) return

      ctx.fillStyle = cfg.bg
      ctx.fillRect(0, 0, W, H)

      // Paddle — keyboard takes priority; mouse/touch only after first move
      let targetX = paddleX
      if (keysDown['ArrowRight']) targetX = paddleX + 12
      else if (keysDown['ArrowLeft']) targetX = paddleX - 12
      else if (mouseX !== null) targetX = mouseX - paddleW / 2
      paddleX += (targetX - paddleX) * 0.3
      paddleX = Math.max(0, Math.min(W - paddleW, paddleX))

      // Ball physics
      ballX += dx
      ballY += dy

      // Walls
      if (ballX + ballR > W || ballX - ballR < 0) { dx = -dx; ballX = Math.max(ballR, Math.min(W - ballR, ballX)) }
      if (ballY - ballR < 0) dy = -dy

      // Paddle
      const paddleTop = H - paddleH - 6
      if (ballY + ballR > paddleTop && ballY + ballR < paddleTop + paddleH + 10 &&
          ballX > paddleX && ballX < paddleX + paddleW && dy > 0) {
        const hitPos = (ballX - paddleX) / paddleW
        const angle = (hitPos - 0.5) * Math.PI * 0.7
        const speed = Math.sqrt(dx * dx + dy * dy)
        dy = -Math.abs(speed * Math.cos(angle))
        dx = speed * Math.sin(angle)
        ballY = paddleTop - ballR
        if (speed < 10) { const f = 1.02; dx *= f; dy *= f }
      }

      // Bricks — at most one hit per frame, then stop checking
      let hitBrick = false
      for (let r = 0; r < brickRows && !hitBrick; r++) {
        for (let c = 0; c < brickCols; c++) {
          const b = bricks[r][c]
          if (!b.alive) continue
          const closestX = Math.max(b.x, Math.min(ballX, b.x + brickW))
          const closestY = Math.max(b.y, Math.min(ballY, b.y + brickH))
          const distX = ballX - closestX
          const distY = ballY - closestY
          if (distX * distX + distY * distY < ballR * ballR) {
            b.hp--
            if (b.hp <= 0) b.alive = false
            addScore(b.alive ? 5 : 10)

            const overlapLeft = ballX + ballR - b.x
            const overlapRight = b.x + brickW - (ballX - ballR)
            const overlapTop = ballY + ballR - b.y
            const overlapBottom = b.y + brickH - (ballY - ballR)
            if (Math.min(overlapLeft, overlapRight) < Math.min(overlapTop, overlapBottom)) dx = -dx
            else dy = -dy

            hitBrick = true
            break
          }
        }
      }

      // Ball lost
      if (ballY + ballR > H + 20) {
        lives_--
        setLives(lives_)
        if (lives_ <= 0) {
          phase = 'over'
          running = false
          setGameOver(true)
          drawPaddle(); drawBricks(); drawHUD()
          drawOverlay('Game Over', `Final Score: ${scoreRef.current} · Press Space or Play Again to restart`)
          return
        }
        ballX = paddleX + paddleW / 2
        ballY = H - paddleH - ballR - 10
        dx = cfg.speed * (Math.random() > 0.5 ? 1 : -1)
        dy = -cfg.speed
      }

      // Win / level up
      if (phase === 'playing' && bricksLeft() === 0) {
        running = false
        if (lvl < MAX_LEVEL) {
          phase = 'levelup'
          drawPaddle(); drawBricks(); drawHUD()
          drawOverlay(`Level ${lvl} Complete! 🎉`, `Next: Level ${lvl + 1} · Score: ${scoreRef.current}`)
          levelTimeout = setTimeout(() => setLevel(lvl + 1), 2500)
        } else {
          phase = 'won'
          setWon(true)
          drawPaddle(); drawBricks(); drawHUD()
          drawOverlay('You Win! 🏆', `All 4 levels cleared · Final Score: ${scoreRef.current}`)
        }
        return
      }

      drawBall()
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
    }
    // Re-runs only when the level advances or a new game (runId) starts —
    // deliberately NOT on gameOver/won, so the end screen stays put and
    // no fresh game silently restarts behind the overlay.
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
          <a href="/" style={{ color: '#a7c4a0', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← News Digest</a>
          <span style={{ fontSize: 13, color: '#7a8f6e' }}>Arrow keys / mouse to move · Space to restart</span>
        </div>

        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: 'min(800px, calc(100vw - 40px))', touchAction: 'none' }} />

        {(gameOver || won) && (
          <button onClick={() => restartRef.current()} style={{
            marginTop: 20, padding: '12px 36px', borderRadius: 8, border: 'none',
            background: LEVEL_BTN_COLORS[Math.min(level, MAX_LEVEL) - 1],
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>Play Again</button>
        )}

        <div style={{ marginTop: 24, fontSize: 12, color: '#5a6e5a' }}>Classic Breakout · 4 Levels · Arrow keys / mouse / touch</div>
      </div>
    </>
  )
}
