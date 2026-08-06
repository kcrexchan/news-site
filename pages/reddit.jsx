import React from 'react'
import Head from 'next/head'
import fs from 'fs'
import path from 'path'

export async function getStaticProps() {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'reddit.json')
    const raw = fs.readFileSync(dataPath, 'utf8')
    return { props: JSON.parse(raw) }
  } catch (e) {
    return { props: { date: '', summaries: [], error: 'No Reddit data available yet.' }, revalidate: 60 }
  }
}

export default function Reddit({ date, summaries, error }) {
  if (error) {
    return (
      <>
        <Head>
          <title>Reddit Roundup · Local LLM Hub</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        </Head>
        <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#ff9800' }}>
            <p style={{ fontSize: 28, fontWeight: 700 }}>{error}</p>
            <a href="/" style={{ color: '#ffa726', fontSize: 14 }}>← Back to homescreen</a>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Reddit Roundup · Local LLM Hub</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter', sans-serif", color: '#e0e0e0' }}>
        
        {/* Header */}
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 2rem 0' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <a href="/" style={{ color: '#ff9800', textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,152,0,0.2)', backdropFilter: 'blur(8px)' }}>← Homescreen</a>
            <span style={{ fontSize: 13, color: '#8a8a8a' }}>{summaries.length} summaries · {date}</span>
          </nav>

          {/* Title */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 32, padding: '48px 64px', backdropFilter: 'blur(16px)', boxShadow: '0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(32px,6vw,52px)', fontWeight: 700, letterSpacing: '-.03em', background: 'linear-gradient(135deg,#ff9800,#ffb74d,#fdd835,#f57c00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>Reddit Roundup</h1>
            <p style={{ fontSize: 16, color: '#ff8a65' }}>Top stories from r/LocalLLaMA and r/localllm — curated &amp; summarized daily</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ maxWidth: '960px', margin: '3rem auto 4rem', padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {summaries.map((s, i) => (
            <a href={s.url} target="_blank" rel="noopener noreferrer" key={i} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', transition: 'all .3s ease', borderLeft: `4px solid ${['#ff9800','#ffb74d','#ffa726','#ff8a65'][i % 4]}` }}
                   onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' }}
                   onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 'clamp(16px,3vw,19px)', fontWeight: 700, color: '#ffcc80', margin: 0 }}>{s.title}</h3>
                  {s.subreddit && (
                    <span style={{ padding: '4px 12px', borderRadius: 16, background: s.subreddit === 'r/LocalLLaMA' ? 'rgba(255,232,214,0.3)' : 'rgba(255,235,224,0.3)', fontSize: 12, color: s.subreddit === 'r/LocalLLaMA' ? '#ff9800' : '#ffa726', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.subreddit}</span>
                  )}
                </div>
                {s.summary && (
                  <p style={{ fontSize: 'clamp(14px,2.5vw,16px)', lineHeight: 1.75, color: '#ffcc80', marginTop: 10 }}>{s.summary}</p>
                )}
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '2rem', color: '#bf7c00', fontSize: 13, borderTop: '1px solid rgba(255,152,0,0.1)' }}>
          Curated by Hermes Agent · Powered by Reddit &amp; Next.js
        </footer>
      </div>
    </>
  )
}