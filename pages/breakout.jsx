import React, { useRef, useEffect, useState } from 'react'
import Head from 'next/head'

export default function Breakout() {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [level, setLevel] = useState(1)
  const runningRef = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Responsive sizing
    const W = Math.min(800, window.innerWidth - 40)
    const H = 600
    canvas.width = W
    canvas.height = H

    // Level config — each level has a distinct brick PATTERN (0 = gap, 1-9 = brick HP)
    const lvl = level || 1
    const levels = {
      1: {
        name: 'Forest', speed: 4, paddleColor: '#6b9e4a', ballColor: '#ecfccb', bg: '#0f1a0f', hudColor: '#a7c4a0', subColor: '#7a8f6e',
        colors: ['#3a6b1e','#5a9e3f','#7ab850','#c8a951','#d4923a','#c0552d'],
        pattern: [
          '111111111111',
          '111111111111',
          '111111111111',
          '111111111111',
          '111111111111',
          '111111111111',
        ],
      },
      2: {
        name: 'Checker', speed: 4.5, paddleColor: '#2980b9', ballColor: '#d6eaf8', bg: '#0a1628', hudColor: '#85c1e9', subColor: '#5dade2',
        colors: ['#1a3a5c','#1e5a8a','#2980b9','#3498db','#5dade2','#85c1e9'],
        pattern: [
          '101010101010',
          '010101010101',
          '101010101010',
          '010101010101',
          '101010101010',
          '010101010101',
          '101010101010',
          '010101010101',
        ],
      },
      3: {
        name: 'Pyramid', speed: 5, paddleColor: '#d4432e', ballColor: '#fdebd0', bg: '#1a0a0a', hudColor: '#f5b041', subColor: '#e67e22',
        colors: ['#6b1010','#a62525','#d4432e','#e67e22','#f39c12','#f5b041'],
        pattern: [
          '.....22.....',
          '....2222....',
          '...222222...',
          '..22222222..',
          '.2222222222.',
          '222222222222',
        ],
      },
      4: {
        name: 'Diamond', speed: 5, paddleColor: '#8e44ad', ballColor: '#f5eef8', bg: '#0a0a1a', hudColor: '#bb8fce', subColor: '#a569bd',
        colors: ['#2d1b69','#4a2c82','#6c3483','#8e44ad','#a569bd','#bb8fce'],
        pattern: [
          '.....11.....',
          '....1111....',
          '...111111...',
          '..11111111..',
          '..11111111..',
          '...111111...',
          '....1111....',
          '.....11.....',
        ],
      },
      5: {
        name: 'Pillars', speed: 5.5, paddleColor: '#b7950b', ballColor: '#fef9e7', bg: '#141007', hudColor: '#f4d03f', subColor: '#d4ac0d',
        colors: ['#7d6608','#b7950b','#d4ac0d','#f1c40f','#f7dc6f','#fdebd0'],
        pattern: [
          '110011001100',
          '110011001100',
          '110011001100',
          '110011001100',
          '110011001100',
          '110011001100',
          '110011001100',
        ],
      },
      6: {
        name: 'Fortress', speed: 6, paddleColor: '#c0392b', ballColor: '#fdedec', bg: '#150505', hudColor: '#f1948a', subColor: '#e74c3c',
        colors: ['#78281f','#922b21','#c0392b','#e74c3c','#ec7063','#f5b7b1'],
        pattern: [
          '333333333333',
          '3..........3',
          '3..222222..3',
          '3..222222..3',
          '3..222222..3',
          '3..........3',
          '333333333333',
        ],
      },
    }
    const cfg = levels[lvl] || levels[1]

    // Game objects
    const paddleW = Math.max(100, W * 0.2)
    const paddleH = 14
    let paddleX = (W - paddleW) / 2
    
    const ballR = 8
    let ballX = W / 2
    let ballY = H - paddleH - 30
    let dx = cfg.speed * (Math.random() > 0.5 ? 1 : -1)
    let dy = -cfg.speed

    // Bricks — built from the level's pattern (0 = gap, 1-9 = HP). Pattern width = number of columns.
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
        const ch = rowStr[c] !== undefined ? rowStr[c] : '0'
        const hp = parseInt(ch, 10)  // 0 = gap, 1-9 = brick HP
        if (isNaN(hp) || hp <= 0) {
          bricks[r][c] = { alive: false, hp: 0 }  // gap cell
        } else {
          bricks[r][c] = { x: c * (brickW + brickPad) + 4, y: r * (brickH + brickPad) + 60, alive: true, hp }
        }
      }
    }

    let score_ = 0
    let lives_ = 3
    runningRef.current = true

    // Input
    const keysDown = {}
    function onKey(e, down) { keysDown[e.key] = down }
    window.addEventListener('keydown', (e) => { if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault(); onKey(e, true) })
    window.addEventListener('keyup', (e) => onKey(e, false))

    // Touch/mouse for mobile
    let mouseX = W / 2
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect()
      mouseX = e.clientX - rect.left
    })
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      mouseX = e.touches[0].clientX - rect.left
    }, { passive: false })

    let animId

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
          const r2 = 3
          ctx.beginPath()
          ctx.roundRect(b.x, b.y, brickW, brickH, r2)
          ctx.fill()
          // Show HP for multi-hit bricks
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

    function drawHUD() {
      ctx.fillStyle = cfg.hudColor
      ctx.font = '16px Inter, sans-serif'
      ctx.fillText(`Lvl ${lvl} · ${cfg.name} · Score: ${score_}`, 12, 30)
      
      // Lives as small dots
      for (let i = 0; i < lives_; i++) {
        const lx = W - 40 + i * 22
        ctx.fillStyle = cfg.ballColor
        ctx.beginPath()
        ctx.arc(lx, 18, 6, 0, Math.PI * 2)
        ctx.fill()
      }

      // Total bricks remaining
      let total = 0
      for (let r = 0; r < brickRows; r++)
        for (let c = 0; c < brickCols; c++)
          if (bricks[r][c].alive) total++
      
      ctx.fillStyle = cfg.subColor
      ctx.font = '12px Inter, sans-serif'
      ctx.fillText(`${total} bricks left`, W / 2 - 30, H - 4)
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
      if (!runningRef.current) return
      
      // Clear
      ctx.fillStyle = cfg.bg
      ctx.fillRect(0, 0, W, H)

      // Paddle movement — keyboard priority, then mouse/touch fallback
      let targetX = paddleX + (keysDown['ArrowRight'] ? 12 : 0) - (keysDown['ArrowLeft'] ? 12 : 0)
      
      if (!keysDown['ArrowRight'] && !keysDown['ArrowLeft']) {
        // Mouse/touch follow
        targetX = mouseX - paddleW / 2
      }

      paddleX += (targetX - paddleX) * 0.3 // smooth interpolation
      paddleX = Math.max(0, Math.min(W - paddleW, paddleX))

      // Ball physics — only move if not launched
      ballX += dx
      ballY += dy

      // Wall collision
      if (ballX + ballR > W || ballX - ballR < 0) { dx = -dx; ballX = Math.max(ballR, Math.min(W - ballR, ballX)) }
      if (ballY - ballR < 0) dy = -dy

      // Paddle collision
      const paddleTop = H - paddleH - 6
      if (ballY + ballR > paddleTop && ballY + ballR < paddleTop + paddleH + 10 &&
          ballX > paddleX && ballX < paddleX + paddleW) {
        // Angle based on where it hits the paddle
        const hitPos = (ballX - paddleX) / paddleW // 0 to 1
        const angle = (hitPos - 0.5) * Math.PI * 0.7 // -63° to +63°
        const speed = Math.sqrt(dx * dx + dy * dy)
        dy = -Math.abs(speed * Math.cos(angle))
        dx = speed * Math.sin(angle)
        ballY = paddleTop - ballR
        
        // Speed up slightly on each hit
        if (speed < 10) {
          const factor = 1.02
          dx *= factor
          dy *= factor
        }
      }

      // Brick collision
      for (let r = 0; r < brickRows && runningRef.current; r++) {
        for (let c = 0; c < brickCols; c++) {
          const b = bricks[r][c]
          if (!b.alive) continue
          
          // Ball vs rectangle collision
          const closestX = Math.max(b.x, Math.min(ballX, b.x + brickW))
          const closestY = Math.max(b.y, Math.min(ballY, b.y + brickH))
          const distX = ballX - closestX
          const distY = ballY - closestY
          
          if (distX * distX + distY * distY < ballR * ballR) {
            b.hp--
            if (b.hp <= 0) b.alive = false
            score_ += b.alive ? 5 : 10
            
            // Determine bounce direction
            const overlapLeft = ballX + ballR - b.x
            const overlapRight = b.x + brickW - (ballX - ballR)
            const overlapTop = ballY + ballR - b.y
            const overlapBottom = b.y + brickH - (ballY - ballR)
            
            const minOverlapX = Math.min(overlapLeft, overlapRight)
            const minOverlapY = Math.min(overlapTop, overlapBottom)
            
            if (minOverlapX < minOverlapY) dx = -dx
            else dy = -dy
            
            setScore(score_)
            break // only hit one brick per frame
          }
        }
      }

      // Ball falls below paddle — lose life
      if (ballY + ballR > H + 20) {
        lives_--
        setLives(lives_)
        
        if (lives_ <= 0) {
          runningRef.current = false
          setGameOver(true)
          // Draw final state before stopping
          drawPaddle()
          drawBricks()
          drawHUD()
          drawOverlay('Game Over', `Final Score: ${score_}`)
          return
        }

        // Reset ball on paddle
        ballX = paddleX + paddleW / 2
        ballY = H - paddleH - ballR - 10
        dx = cfg.speed * (Math.random() > 0.5 ? 1 : -1)
        dy = -cfg.speed
      }

      // Win check — all bricks destroyed
      let aliveCount = 0
      for (let r = 0; r < brickRows; r++)
        for (let c = 0; c < brickCols; c++)
          if (bricks[r][c].alive) aliveCount++

      if (aliveCount === 0 && runningRef.current) {
        runningRef.current = false
        if (lvl < 6) {
          // Level complete — advance
          drawPaddle()
          drawBricks()
          drawHUD()
          drawOverlay(`Level ${lvl} Complete! 🎉`, `Next: Level ${lvl + 1} — ${levels[lvl + 1]?.name} · Score: ${score_}`)
          setTimeout(() => {
            setLevel(lvl + 1)
            setScore(0)
            setLives(3)
            setGameOver(false)
            setWon(false)
          }, 2500)
        } else {
          // Game won — all levels done
          setWon(true)
          drawPaddle()
          drawBricks()
          drawHUD()
          drawOverlay('You Win! 🏆', `All 6 levels cleared · Final Score: ${score_}`)
        }
        return
      }

      // Draw everything
      drawBall()
      drawPaddle()
      drawBricks()
      drawHUD()

      animId = requestAnimationFrame(loop)
    }

    loop()

    return () => { cancelAnimationFrame(animId); runningRef.current = false }
  }, [gameOver, won, level]) // re-mount on restart handled by state reset below

  function restart() {
    setScore(0)
    setLives(3)
    setGameOver(false)
    setWon(false)
    setLevel(1)
    // Force remount by clearing and recreating — we'll just reload the page for simplicity
    window.location.reload()
  }

  return (
    <>
      <Head>
        <title>Breakout 🌿</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0f1a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: '#ecfccb' }}>
        {/* Header bar */}
        <div style={{ width: 'min(800px, 100%)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(167,139,108,0.15)' }}>
          <a href="/" style={{ color: '#a7c4a0', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← News Digest</a>
          <span style={{ fontSize: 13, color: '#7a8f6e' }}>Arrow keys / mouse to move · Space to restart</span>
        </div>

        {/* Game canvas */}
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: 'min(800px, calc(100vw - 40px))' }} />

        {/* Restart button overlay (shown when game over) */}
        {(gameOver || won) && (
          <button onClick={restart} style={{
            marginTop: 20, padding: '12px 36px', borderRadius: 8, border: 'none',
            background: ['#6b9e4a','#2980b9','#d4432e','#8e44ad','#b7950b','#c0392b'][Math.min(level, 6) - 1],
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>Play Again</button>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, fontSize: 12, color: '#5a6e5a' }}>Built with Canvas API · 6 Levels · Arrow keys / mouse / touch</div>
      </div>
    </>
  )
}
