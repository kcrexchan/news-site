import React, { useState } from 'react';
import Head from 'next/head';

/* =========================================================================== */
/*  Particle canvas hook                                                   */
/* =========================================================================== */
function useParticles(canvasRef) {
  const init = React.useRef(false);

  React.useEffect(() => {
    if (init.current || !canvasRef.current) return;
    init.current = true

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId, w, h
    const particles = []

    function resize() {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.8 + 0.5,
        dx: (Math.random() - 0.5) * 0.35, dy: -(Math.random() * 0.4 + 0.1),
        alpha: Math.random() * 0.4 + 0.1,
      })
    }

    function draw(time) {
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        const hue = 100 + Math.sin(time / 5000 + p.x * 0.01) * 40
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue}, 60%, ${35 + Math.sin(time / 3000) * 10}%, ${p.alpha})`
        ctx.fill()

        for (const q of particles) {
          if (q === p) continue
          const dist = Math.hypot(p.x - q.x, p.y - q.y)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(134,196,118,${0.05 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5; ctx.stroke()
          }
        }

        p.x += p.dx; p.y += p.dy
        if (p.x < 0 || p.x > w) p.dx *= -1
        if (p.y < 0 || p.y > h) p.dy *= -1
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])
}

/* =========================================================================== */
/*  Animated gradient hook                                                */
/* =========================================================================== */
function useAnimatedGradient() {
  const [hue, setHue] = React.useState(0)
  React.useEffect(() => {
    let raf
    function tick(t) { setHue((t / 30) % 60); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const c1 = `hsl(${100 + hue}, 55%, ${38 - hue * 0.04}%)`
  const c2 = `hsl(${65 + hue * 0.7}, 50%, ${40 - hue * 0.03}%)`
  return { gradient: `linear-gradient(135deg, ${c1}, ${c2})`, accent1: c1, accent2: c2 }
}

/* =========================================================================== */
/*  Page                                                                    */
/* =========================================================================== */
export default function Home() {
  const canvasRef = React.useRef(null)
  useParticles(canvasRef)
  const animGrad = useAnimatedGradient()
  const [hoveredIdx, setHoveredIdx] = useState(-1)

  function formatDate(isoStr) {
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return isoStr || 'Unknown'
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' · Updated at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })
    } catch { return isoStr || 'Unknown' }
  }

  // Use CSS variables so the theme toggle actually works
  const v = {
    bg: 'var(--bg-primary)',
    cardBg: 'var(--bg-card)',
    border: 'var(--border-color)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
  }

  const s = {
    page: { minHeight: '100vh', background: v.bg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", color: v.textPrimary, position: 'relative', overflowX: 'hidden' },
    canvasLayer: { position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' },

    content: { maxWidth: 960, margin: '0 auto', padding: '5rem 2rem', position: 'relative', zIndex: 1 },

    /* Hero */
    hero: { textAlign: 'center', marginBottom: '3.5rem', opacity: 0, animation: 'heroFadeIn 0.8s ease-out forwards' },
    title: { fontSize: 48, fontWeight: 700, margin: '0 0 12px', background: animGrad.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', transition: 'background 2s ease' },
    subtitle: { fontSize: 17, color: v.textSecondary, margin: '0 0 20px' },

    /* Nav cards grid */
    navGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: '3.5rem' },

    cardContainer: (i) => ({ position: 'relative', transformStyle: 'preserve-3d' }),
    card: (i) => ({
      background: v.cardBg, border: `1px solid ${v.border}`, borderRadius: 16, padding: i === hoveredIdx ? '28px' : '24px',
      position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s ease',
      transform: i === hoveredIdx ? 'translateY(-4px)' : 'translateY(0)',
    }),
    cardGlow: (i) => ({
      position: 'absolute', inset: -1, borderRadius: 16, opacity: i === hoveredIdx ? 0.5 : 0, pointerEvents: 'none',
      background: `radial-gradient(ellipse at var(--mx, 50%) var(--my, 30%), rgba(134,196,118,0.12) 0%, transparent 70%)`, transition: 'opacity 0.3s ease', filter: 'blur(4px)',
    }),
    cardIcon: { fontSize: 36, marginBottom: 14 },
    cardTitle: { fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: v.textPrimary },
    cardDesc: { fontSize: 14, lineHeight: 1.65, color: v.textSecondary, margin: '0 0 20px' },

    /* Card button */
    cardBtn: (i) => ({
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10,
      background: i === hoveredIdx ? animGrad.gradient : 'rgba(134,196,118,0.08)',
      border: `1px solid ${i === hoveredIdx ? 'transparent' : v.border}`, color: v.textPrimary, fontSize: 15, fontWeight: 600, textDecoration: 'none', transition: 'all 0.3s ease', cursor: 'pointer',
    }),

    /* Summary box */
    summaryBox: { background: v.cardBg, border: `1px solid ${v.border}`, borderRadius: 12, padding: '2rem', marginBottom: '3.5rem', position: 'relative', overflow: 'hidden' },
    shimmerLine: { position: 'absolute', top: 0, left: '-80px', width: '60px', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(134, 196, 118, 0.12), transparent)', animation: 'shimmerMove 3s ease-in-out infinite' },
    sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: animGrad.accent1, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, transition: 'color 2s ease' },
    labelBar: { width: 3, height: 16, borderRadius: 2, background: animGrad.gradient, transition: 'background 2s ease' },
    summaryText: { fontSize: 17, lineHeight: 1.85, color: v.textSecondary, margin: 0 },

    /* Tags */
    tagContainer: { marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' },
    tag: (i) => ({ padding: '6px 16px', borderRadius: 20, background: i === hoveredIdx ? 'rgba(134,196,118,0.1)' : 'rgba(134,196,118,0.05)', border: `1px solid rgba(134,196,118,${i === hoveredIdx ? 0.25 : 0.12})`, fontSize: 12, color: v.textSecondary }),

    /* Footer */
    footer: { marginTop: '3rem', paddingTop: '2rem', borderTop: `1px solid ${v.border}`, textAlign: 'center', fontSize: 13, color: v.textMuted },
    dotPulse: (d) => ({ width: 6, height: 6, borderRadius: '50%', animation: `dotPulse 2s ease-in-out ${d}s infinite` }),

    /* Container entrance */
    containerEntrance: { opacity: 0, transform: 'translateY(20px)', animation: 'containerSlideIn 1s cubic-bezier(.25,.46,.45,.94) forwards' },
  }

  const navItems = [
    { icon: '🎮', title: 'Games', desc: "Tetris & Breakout - Classic arcade games with mobile touch controls.", href: '/games' },
    { icon: '📰', title: 'Digest', desc: "Curated updates on local models, on-device AI, and the latest in edge computing.", href: '/digest' },
    { icon: '🔁', title: 'Round up', desc: 'Top stories from r/LocalLLaMA & r/localllm — curated & summarized daily.', href: '/reddit' },
  ]

  const digestSummary = `Local LLM tooling keeps maturing fast: Ollama 0.30 shipped with improved GGUF/llama.cpp compatibility alongside its MLX engine, while both Ollama and LM Studio added Anthropic-compatible endpoints letting local models drop into agent workflows. On-device AI is spreading too — AI browsers like Puma run Qwen/Gemma fully offline on phones, and NPU advances (Qualcomm/CXMT 3D DRAM, VeriSilicon 40+ TOPS IP) push billion-parameter models to real-time speeds.`

  return (
    <>
      <Head>
        <title>Homescreen · Local LLM Hub</title>
        <meta name="description" content={digestSummary} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: var(--bg-secondary); border-radius: 4px; }
          ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #4a90d9, #6ba3ff); border-radius: 4px; transition: background 2s ease; }
          ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #2563eb, #7c3aed); }
          ::selection { background: rgba(134,196,118,0.3); color: var(--text-primary); }
          body { overflow-x: hidden; }

          @keyframes containerSlideIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes heroFadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes shimmerMove { 0% { left: -60px; } 100% { left: calc(100% + 20px); } }
          @keyframes dotPulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        `}</style>
      </Head>

      <div style={{ ...s.page, position: 'relative', zIndex: 1 }}>
        <canvas ref={canvasRef} style={s.canvasLayer} />
        <div style={{ ...s.content, ...s.containerEntrance }}>

          {/* Hero */}
          <header style={s.hero}>
            <h1 style={s.title}>Local LLM Hub</h1>
            <p style={s.subtitle}>News · Games · Tools — all running locally</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '8px 20px', borderRadius: 24, background: 'rgba(134, 196, 118, 0.02371615110147546)', border: '1px solid rgba(134, 196, 118, 0.15)', fontSize: 13, color: v.textSecondary }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(181.25, 70%, 55%)', boxShadow: '0 0 12px hsla(181.25, 70%, 55%, 0.6)' }} />
              <span style={{ fontWeight: 600, color: v.textPrimary }}>Thursday, August 13, 2026 · Updated at 09:33:49 AM PDT</span>
            </div>
          </header>

          {/* Nav Cards */}
          <nav style={s.navGrid}>
            {navItems.map((item, index) => (
              <a key={index} href={item.href} className="news-card" target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined} onMouseEnter={() => setHoveredIdx(index)} onMouseLeave={() => setHoveredIdx(-1)}>
                <div style={{ ...s.cardContainer(index), position: 'relative' }}>
                  <div style={{ ...s.cardGlow(hoveredIdx === index ? 1 : 0) }} />
                  <div style={{ ...s.card(hoveredIdx === index ? 1 : 0, hoveredIdx === index) }}>
                    <span style={s.cardIcon}>{item.icon}</span>
                    <h3 style={s.cardTitle}>{item.title}</h3>
                    <p style={s.cardDesc}>{item.desc}</p>
                    <div style={{ ...s.cardBtn(hoveredIdx === index ? 1 : 0), position: 'relative' }}>Explore →</div>
                  </div>
                </div>
              </a>
            ))}
          </nav>

          {/* Summary */}
          <section style={s.summaryBox}>
            <div style={s.shimmerLine} />
            <div style={{ ...s.sectionLabel }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: animGrad.gradient }} />
              Latest Digest Highlights
            </div>
            <p style={s.summaryText}>{digestSummary}</p>
            <div style={s.tagContainer}>
              {['Ollama 0.30', 'Anthropic API', 'On-Device AI', 'NPU Advances'].map((tag, i) => (
                <span key={i} style={{ ...s.tag(i), background: i === hoveredIdx ? 'rgba(134,196,118,0.1)' : 'rgba(134,196,118,0.05)', border: `1px solid rgba(134,196,118,${i === hoveredIdx ? 0.25 : 0.12})` }}>{tag}</span>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer style={s.footer}>
            <p>Curated by Hermes Agent · Built with Next.js</p>
            <div style={{ marginTop: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', margin: '0 4px', animation: 'dotPulse 2s ease-in-out 0s infinite' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', margin: '0 4px', animation: 'dotPulse 2s ease-in-out 0.4s infinite' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', margin: '0 4px', animation: 'dotPulse 2s ease-in-out 0.8s infinite' }} />
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}
