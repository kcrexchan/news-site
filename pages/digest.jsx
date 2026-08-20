import React, { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import fs from 'fs'
import path from 'path'

export async function getStaticProps() {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'news.json')
    const raw = fs.readFileSync(dataPath, 'utf8')
    return { props: JSON.parse(raw) }
  } catch (e) {
    return { props: { summary: '', details: [] }, revalidate: 60 }
  }
}

export default function Digest({ summary, details }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  
  const displayItems = expanded ? details : details.slice(0, 3)
  
  return (
    <>
      <Head>
        <title>Digest · Local LLM Hub</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter', sans-serif", color: '#e0e0e0' }}>
        
        {/* Header */}
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 2rem 0' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <button onClick={() => router.back()} style={{ color: '#4a90d9', background: 'rgba(74,144,217,0.2)', border: 'none', fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: 'inherit' }}>← Back</button>
            <span style={{ fontSize: 13, color: '#8a8a8a' }}>{details.length} articles · Updated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </nav>

          {/* Title */}
          <div className="bg-card" style={{ borderRadius: 32, padding: '48px 64px', backdropFilter: 'blur(16px)', boxShadow: '0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(32px,6vw,52px)', fontWeight: 700, letterSpacing: '-.03em', background: 'linear-gradient(135deg,#4a90d9,#6ba3ff,#8b5cf6,#1e3a5f)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>LLM News Digest</h1>
            <p style={{ fontSize: 16 }} className="text-secondary">Curated updates on local AI models and edge computing</p>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div style={{ maxWidth: '960px', margin: '3rem auto 2rem', padding: '0 2rem' }}>
            <div className="bg-card" style={{ borderRadius: 24, padding: 'clamp(1.5rem,4vw,2.5rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2.5, color: '#4a90d9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 4, height: 24, borderRadius: 2, background: 'linear-gradient(135deg,#4a90d9,#6ba3ff)' }} />
                Executive Summary
              </div>
              <p style={{ fontSize: 'clamp(15px,3vw,17px)', lineHeight: 1.85 }} className="text-secondary">{summary}</p>
            </div>
          </div>
        )}

        {/* Article Cards */}
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '0 2rem 4rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {displayItems.map((item, i) => (
            <a href={item.url} target="_blank" rel="noopener noreferrer" key={i} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="bg-card" style={{ borderRadius: 20, padding: 'clamp(1.25rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', transition: 'all .3s ease', borderLeft: '4px solid transparent' }}
                   onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'; e.currentTarget.style.borderLeftColor = '#4a90d9' }}
                   onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'; e.currentTarget.style.borderLeftColor = 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
                  <h3 className="text-primary" style={{ fontSize: 'clamp(16px,3vw,19px)', fontWeight: 700, margin: 0 }}>{item.title}</h3>
                  {item.source && (
                    <span className="text-primary" style={{ padding: '4px 12px', borderRadius: 16, background: 'rgba(74,144,217,0.2)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{item.source}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-secondary" style={{ fontSize: 'clamp(13px,2.5vw,15px)', lineHeight: 1.7, marginTop: 8 }}>{item.description}</p>
                )}
              </div>
            </a>
          ))}

          {/* Expand/Collapse */}
          {details.length > 3 && (
            <button onClick={() => setExpanded(!expanded)} className="bg-card" style={{ margin: '1rem auto', padding: '12px 32px', borderRadius: 16, border: 'none', background: expanded ? 'var(--bg-card)' : 'linear-gradient(135deg,#4a90d9,#6ba3ff)', color: expanded ? 'var(--text-secondary)' : '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,144,217,0.3)' }}>
              {expanded ? `Show less` : `View all ${details.length} articles`} →
            </button>
          )}
        </div>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '2rem', color: '#5d7a5e', fontSize: 13, borderTop: '1px solid rgba(134,196,118,0.1)' }}>
          Curated by Hermes Agent · Powered by web search &amp; Next.js
        </footer>
      </div>
    </>
  )
}