import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import tideStations from '../data/tide-stations'

/* =========================================================================== */
/*  Helpers                                                                  */
/* =========================================================================== */

// Local (viewer) calendar date as YYYY-MM-DD for the date input default.
function todayLocal() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// NOAA times are already station-local ("2026-09-10 04:43") — format the
// HH:MM portion as 12-hour without any timezone conversion.
function fmtTime(t) {
  if (typeof t !== 'string') return ''
  const m = /(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return t
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

// Short tick label for chart axes ("6 AM", "3:30 PM").
function fmtTick(t) {
  if (typeof t !== 'string') return ''
  const m = /(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return t
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return min === '00' ? `${h} ${ampm}` : `${h}:${min} ${ampm}`
}

function fmtHeight(ft) {
  const n = Number(ft)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(2)} ft`
}

// Calendar label for a NOAA time string ("2026-09-10 04:43" -> "Sep 10").
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function fmtDateLabel(t) {
  if (typeof t !== 'string') return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t.trim())
  if (!m) return t.slice(0, 10)
  const monthIdx = parseInt(m[2], 10) - 1
  if (monthIdx < 0 || monthIdx > 11) return t.slice(0, 10)
  return `${MONTHS_SHORT[monthIdx]} ${parseInt(m[3], 10)}`
}

// Day-of-week label from the same NOAA date portion ("2026-09-10" -> "Thu").
// Calendar-only arithmetic (no timezone conversion) — matches the date NOAA
// already reports in the station's local time.
function fmtWeekday(t) {
  if (typeof t !== 'string') return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t.trim())
  if (!m) return ''
  const y = parseInt(m[1], 10)
  const monthIdx = parseInt(m[2], 10) - 1
  const day = parseInt(m[3], 10)
  const d = new Date(y, monthIdx, day)
  if (Number.isNaN(d.getTime())) return ''
  return WEEKDAYS_SHORT[d.getDay()]
}

/* =========================================================================== */
/*  Tide curve chart — hand-built inline SVG, no dependencies                */
/* =========================================================================== */
function TideChart({ curve, unavailableReason }) {
  const W = 760
  const H = 300
  const M = { top: 18, right: 14, bottom: 34, left: 52 }
  const plotW = W - M.left - M.right
  const plotH = H - M.top - M.bottom

  if (!Array.isArray(curve) || curve.length < 2) {
    return (
      <div style={{ fontSize: 14, color: '#8a8a8a', padding: '1rem 0' }}>
        {unavailableReason || 'No water-level data available for this date.'}
      </div>
    )
  }

  const heights = curve.map((p) => p.height)
  let minH = Math.min(...heights)
  let maxH = Math.max(...heights)
  if (minH === maxH) { minH -= 1; maxH += 1 }
  const padY = Math.max(0.4, (maxH - minH) * 0.12)
  minH -= padY
  maxH += padY

  // X positions are evenly spaced by index (NOAA's curve is a uniform grid).
  const n = curve.length
  const xAt = (i) => M.left + (plotW * i) / (n - 1)
  const yAt = (h) => M.top + plotH * (1 - (h - minH) / (maxH - minH))

  const linePath = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(2)},${yAt(p.height).toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L${(M.left + plotW).toFixed(2)},${(M.top + plotH).toFixed(2)} L${M.left.toFixed(2)},${(M.top + plotH).toFixed(2)} Z`

  // Y ticks: 5 evenly spaced gridlines.
  const yTicks = []
  for (let k = 0; k <= 4; k++) {
    const h = maxH - ((maxH - minH) * k) / 4
    yTicks.push({ label: `${h.toFixed(1)} ft`, y: yAt(h) })
  }

  // X ticks: ~5 evenly spaced time labels.
  const xTickCount = Math.min(5, n)
  const xTicks = []
  for (let k = 0; k < xTickCount; k++) {
    const i = Math.round(((n - 1) * k) / (xTickCount - 1))
    xTicks.push({ label: fmtTick(curve[i].time), x: xAt(i) })
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Tide curve">
      <defs>
        <linearGradient id="tideAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9800" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ff9800" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="tideLineStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff9800" />
          <stop offset="55%" stopColor="#ffb74d" />
          <stop offset="100%" stopColor="#fdd835" />
        </linearGradient>
      </defs>

      {/* Horizontal gridlines + y labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={M.left} y1={t.y} x2={W - M.right} y2={t.y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          <text x={M.left - 8} y={t.y + 4} textAnchor="end" fontSize="12" fill="#8a8a8a">{t.label}</text>
        </g>
      ))}

      {/* Area under the curve */}
      <path d={areaPath} fill="url(#tideAreaFill)" />

      {/* The tide line itself */}
      <path d={linePath} fill="none" stroke="url(#tideLineStroke)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* X-axis baseline + time ticks */}
      <line x1={M.left} y1={M.top + plotH} x2={W - M.right} y2={M.top + plotH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      {xTicks.map((t, i) => (
        <g key={i}>
          <line x1={t.x} y1={M.top + plotH} x2={t.x} y2={M.top + plotH + 5} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <text x={t.x} y={M.top + plotH + 20} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="12" fill="#8a8a8a">{t.label}</text>
        </g>
      ))}

      {/* Y-axis unit hint */}
      <text x={M.left} y={M.top - 6} textAnchor="start" fontSize="11" fill="#5f5f5f">height above MLLW</text>
    </svg>
  )
}

/* =========================================================================== */
/*  Page                                                                     */
/* =========================================================================== */
export default function Tides() {
  const router = useRouter()
  const [stationSlug, setStationSlug] = useState(tideStations[0]?.slug || 'half-moon-bay')
  const [date, setDate] = useState(todayLocal())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (!stationSlug || !date) return
    const myId = ++reqIdRef.current
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/tides?station=${encodeURIComponent(stationSlug)}&date=${encodeURIComponent(date)}`)
      .then(async (r) => {
        let body = null
        try { body = await r.json() } catch {}
        if (!r.ok) throw new Error((body && body.error) || `Request failed (${r.status})`)
        return body
      })
      .then((body) => {
        if (cancelled || myId !== reqIdRef.current) return
        setData(body)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled || myId !== reqIdRef.current) return
        setError(e.message || 'Failed to load tide data.')
        setData(null)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [stationSlug, date])

  /* ---- Lowest tides this month — independent fetch + state ------------- */
  // Calendar month of the selected date (YYYY-MM). Re-derives whenever the
  // date picker crosses into a different month.
  const monthKey = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : null
  const [monthLows, setMonthLows] = useState(null)
  const [monthLoading, setMonthLoading] = useState(Boolean(monthKey && stationSlug))
  const [monthError, setMonthError] = useState(null)
  const monthReqIdRef = useRef(0)

  useEffect(() => {
    if (!stationSlug || !monthKey) return
    const myId = ++monthReqIdRef.current
    let cancelled = false
    setMonthLoading(true)
    setMonthError(null)

    fetch(`/api/tides?station=${encodeURIComponent(stationSlug)}&month=${encodeURIComponent(monthKey)}&mode=monthly-lows`)
      .then(async (r) => {
        let body = null
        try { body = await r.json() } catch {}
        if (!r.ok) throw new Error((body && body.error) || `Request failed (${r.status})`)
        return body
      })
      .then((body) => {
        if (cancelled || myId !== monthReqIdRef.current) return
        setMonthLows(body)
        setMonthLoading(false)
      })
      .catch((e) => {
        if (cancelled || myId !== monthReqIdRef.current) return
        setMonthError(e.message || 'Failed to load monthly tides.')
        setMonthLows(null)
        setMonthLoading(false)
      })

    return () => { cancelled = true }
  }, [stationSlug, monthKey])

  const station = tideStations.find((s) => s.slug === (data && data.station ? data.station.slug : stationSlug)) || tideStations[0]

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,152,0,0.25)', borderRadius: 10,
    color: '#e0e0e0', fontSize: 15, padding: '10px 12px', fontFamily: 'inherit', outline: 'none',
    colorScheme: 'dark',
  }

  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 6 }

  return (
    <>
      <Head>
        <title>Tide Table · Local LLM Hub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter', sans-serif", color: '#e0e0e0' }}>

        {/* Header */}
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 2rem 0' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <button onClick={() => router.back()} style={{ color: '#ff9800', background: 'rgba(255,152,0,0.2)', border: 'none', fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: 'inherit' }}>← Back</button>
            <span style={{ fontSize: 13, color: '#8a8a8a' }}>NOAA CO-OPS predictions · MLLW datum</span>
          </nav>

          {/* Title */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 32, padding: '48px 64px', backdropFilter: 'blur(16px)', boxShadow: '0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(32px,6vw,52px)', fontWeight: 700, letterSpacing: '-.03em', background: 'linear-gradient(135deg,#ff9800,#ffb74d,#fdd835,#f57c00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>Tide Table</h1>
            <p style={{ fontSize: 16, color: '#ff8a65' }}>High &amp; low tides and the full water-level curve — pick a station and any date</p>
          </div>

          {/* Controls */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.25rem,3vw,1.75rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', marginTop: 24 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label htmlFor="station-select" style={labelStyle}>Station</label>
                <select id="station-select" value={stationSlug} onChange={(e) => setStationSlug(e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                  {tideStations.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label htmlFor="date-input" style={labelStyle}>Date</label>
                <input id="date-input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} min="2024-01-01" max="2035-12-31" style={{ ...inputStyle, width: '100%' }} />
              </div>
            </div>
            {station && (
              <p style={{ fontSize: 13, color: '#8a8a8a', marginTop: 14, marginBottom: 0 }}>
                {station.name} — {station.subtitle} · Station #{station.noaaId} ({station.lat}, {station.lng})
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '960px', margin: '3rem auto 4rem', padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {loading && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🌊</div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#ffcc80' }}>Fetching tide predictions…</p>
            </div>
          )}

          {!loading && error && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', borderLeft: '4px solid #f57c00' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ff8a65', margin: '0 0 8px' }}>Couldn&apos;t load tides</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: '#e0c9a8' }}>{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* High / Low events table */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#ffcc80', margin: '0 0 4px' }}>Tide events</h3>
                <p style={{ fontSize: 13, color: '#8a8a8a', margin: '0 0 16px' }}>{data.date} · local time at the station</p>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320, fontSize: 15 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8a8a', fontWeight: 700 }}>Time</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8a8a', fontWeight: 700 }}>Height</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8a8a', fontWeight: 700 }}>Tide</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.hilo || []).map((ev, i) => {
                        const high = String(ev.type).toUpperCase() === 'H'
                        return (
                          <tr key={i} style={{ borderBottom: i < data.hilo.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <td style={{ padding: '10px', color: '#e0e0e0', fontWeight: 600 }}>{fmtTime(ev.time)}</td>
                            <td style={{ padding: '10px 10px 10px 0', textAlign: 'right', color: '#ffcc80', fontVariantNumeric: 'tabular-nums' }}>{fmtHeight(ev.height)}</td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700, background: high ? 'rgba(255,152,0,0.18)' : 'rgba(200,169,81,0.16)', color: high ? '#ff9800' : '#c8a951', border: `1px solid ${high ? 'rgba(255,152,0,0.35)' : 'rgba(200,169,81,0.35)'}` }}>
                                {high ? 'High' : 'Low'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tide curve chart */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#ffcc80', margin: '0 0 4px' }}>Water level</h3>
                <p style={{ fontSize: 13, color: '#8a8a8a', margin: '0 0 16px' }}>Predicted tide curve · {data.date}</p>
                <TideChart curve={data.curve} unavailableReason={data.curveUnavailable} />
              </div>
            </>
          )}

          {/* Lowest tides this month — independent section; renders on its own load/error state */}
          {monthKey && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#ffcc80', margin: '0 0 4px' }}>Lowest Tides This Month</h3>
              <p style={{ fontSize: 13, color: '#8a8a8a', margin: '0 0 16px' }}>
                Five deepest predicted lows · {monthKey} · local time at the station
              </p>

              {monthLoading && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🌗</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#ffcc80' }}>Loading lowest tides…</p>
                </div>
              )}

              {!monthLoading && monthError && (
                <div style={{ borderLeft: '4px solid #f57c00', padding: '12px 16px', background: 'rgba(245,124,0,0.08)', borderRadius: 8 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#ff8a65' }}>Couldn&apos;t load monthly tides</p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#e0c9a8' }}>{monthError}</p>
                </div>
              )}

              {!monthLoading && !monthError && monthLows && (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360, fontSize: 15 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8a8a', fontWeight: 700 }}>Rank</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8a8a', fontWeight: 700 }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8a8a', fontWeight: 700 }}>Day</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8a8a', fontWeight: 700 }}>Time</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a8a8a', fontWeight: 700 }}>Height</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monthLows.lowestTides || []).map((ev, i) => (
                        <tr key={i} style={{ borderBottom: i < monthLows.lowestTides.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <td style={{ padding: '10px', width: 56 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', fontSize: 12, fontWeight: 700, background: i === 0 ? 'rgba(253,216,53,0.2)' : 'rgba(255,152,0,0.18)', color: i === 0 ? '#fdd835' : '#ff9800', border: `1px solid ${i === 0 ? 'rgba(253,216,53,0.4)' : 'rgba(255,152,0,0.35)'}` }}>
                              {i + 1}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: '#e0e0e0', fontWeight: 600 }}>{fmtDateLabel(ev.time)}</td>
                          <td style={{ padding: '10px', color: '#8a8a8a' }}>{fmtWeekday(ev.time)}</td>
                          <td style={{ padding: '10px 10px 10px 0', textAlign: 'right', color: '#e0e0e0', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(ev.time)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#ffcc80', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtHeight(ev.height)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '2rem', color: '#bf7c00', fontSize: 13, borderTop: '1px solid rgba(255,152,0,0.1)' }}>
          Data from NOAA CO-OPS · Powered by Next.js
        </footer>
      </div>
    </>
  )
}
