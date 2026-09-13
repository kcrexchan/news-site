import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

/* =========================================================================== */
/*  Honda Clarity PHEV — authoritative EPA figures                             */
/*  Source: EPA fueleconomy.gov (2018/2021 Clarity Plug-in Hybrid, id 39782)   */
/*  - Electric energy use: 31 kWh / 100 mi  -> 0.31 kWh per mile               */
/*  - Combined MPGe: 110 (for reference)                                     */
/*  - Gasoline-only combined MPG: 42                                          */
/*  - Usable battery: 17 kWh                                                  */
/*  - Maximum EV driving range: 47 miles                                      */
/* =========================================================================== */
const CAR = {
  name: 'Honda Clarity PHEV',
  electricUsePerMile: 0.31, // kWh per mile (31 kWh/100 mi, EPA)
  gasMpg: 42, // combined MPG, gasoline only (EPA)
  batteryKwh: 17, // usable battery capacity (Honda/EPA)
  evRange: 47, // miles of electric-only range (EPA)
  annualMiles: 12000, // default annual driving for the savings estimate
}

// Sensible defaults — US national-ish figures. Gas ~$4.50/gal, electricity ~$0.30/kWh.
const DEFAULTS = { gasPrice: 4.50, kwhPrice: 0.30, electricShare: 40 }

export default function EvVsGas() {
  const router = useRouter()
  const [gasPrice, setGasPrice] = useState(DEFAULTS.gasPrice)
  const [kwhPrice, setKwhPrice] = useState(DEFAULTS.kwhPrice)
  const [electricShare, setElectricShare] = useState(DEFAULTS.electricShare)

  const gasP = Number(gasPrice) || 0
  const kwhP = Number(kwhPrice) || 0
  const share = Math.min(100, Math.max(0, Number(electricShare) || 0))

  // Per-mile costs.
  const electricCostMile = kwhP * CAR.electricUsePerMile // $/mile in EV mode
  const gasCostMile = gasP > 0 ? gasP / CAR.gasMpg : 0 // $/mile in gas mode
  // Blended: you get CAR.evRange miles of EV on a full charge; the slider models
  // the % of your driving that falls inside that electric window (short trips)
  // vs gas (long trips).
  const blendedCostMile =
    electricCostMile * (share / 100) + gasCostMile * (1 - share / 100)

  const annualGasCost = gasCostMile * CAR.annualMiles
  const annualBlendedCost = blendedCostMile * CAR.annualMiles

  // Winner of the head-to-head (EV mode vs gas mode), independent of driving split.
  let winner = 'tie'
  if (electricCostMile < gasCostMile) winner = 'electric'
  else if (gasCostMile < electricCostMile) winner = 'gas'

  const cheaper = winner === 'electric' ? electricCostMile : gasCostMile
  const dearer = winner === 'electric' ? gasCostMile : electricCostMile
  const perMileSavings = Math.max(0, dearer - cheaper)
  const pctSavings = dearer > 0 ? (perMileSavings / dearer) * 100 : 0
  // Savings vs driving gas-only for the same miles you'd drive in EV mode.
  const annualSavings = winner === 'electric'
    ? (annualGasCost - annualBlendedCost)
    : Math.max(0, annualGasCost - annualBlendedCost)

  const fmtMoney = (n) => '$' + n.toFixed(2)
  const fmtCents = (n) => (n * 100).toFixed(1) + '¢'

  return (
    <>
      <Head>
        <title>EV vs Gas · Local LLM Hub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter', sans-serif", color: '#e0e0e0' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 2rem 0' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <button
              onClick={() => router.back()}
              style={{ color: '#ff9800', background: 'rgba(255,152,0,0.2)', border: 'none', fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: 'inherit' }}
            >
              ← Back
            </button>
            <span style={{ fontSize: 13, color: '#8a8a8a' }}>Honda Clarity PHEV · EPA figures · fueleconomy.gov</span>
          </nav>

          <div style={{ background: 'var(--bg-card)', borderRadius: 32, padding: '48px 64px', backdropFilter: 'blur(16px)', boxShadow: '0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'clamp(32px,6vw,52px)', fontWeight: 700, letterSpacing: '-.03em', background: 'linear-gradient(135deg,#ff9800,#ffb74d,#fdd835,#f57c00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>EV vs Gas</h1>
            <p style={{ fontSize: 16, color: '#ff8a65' }}>How much cheaper is your Honda Clarity PHEV to run than filling up with gas?</p>
          </div>

          {/* Inputs */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.25rem,3vw,1.75rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', marginTop: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 12 }}>Your local fuel prices</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label htmlFor="gas-price" style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 6 }}>Gas price / gallon</label>
                <input
                  id="gas-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={gasPrice}
                  onChange={(e) => setGasPrice(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label htmlFor="kwh-price" style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 6 }}>Electricity price / kWh</label>
                <input
                  id="kwh-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={kwhPrice}
                  onChange={(e) => setKwhPrice(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a8a', marginBottom: 6 }}>
                % of driving on electric {`(first ${CAR.evRange} miles on a charge) — ${share}%`}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={share}
                onChange={(e) => setElectricShare(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ff9800' }}
              />
              <p style={{ fontSize: 12, color: '#8a8a8a', margin: '6px 0 0' }}>Short trips under {CAR.evRange} mi use battery; longer drives run the gasoline engine.</p>
            </div>
          </div>

          {/* Result */}
          {winner !== 'tie' && (
            <>
              <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', marginTop: 24, borderLeft: winner === 'electric' ? '4px solid #4caf50' : '4px solid #ff9800' }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: winner === 'electric' ? '#66bb6a' : '#ffcc80', margin: '0 0 16px' }}>
                  {winner === 'electric' ? '⚡ Electricity is cheaper.' : '⛽ Gasoline is cheaper.'}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <div style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.25)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, color: '#8a8a8a', marginBottom: 4 }}>Electric mode</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#66bb6a', fontVariantNumeric: 'tabular-nums' }}>{fmtCents(electricCostMile)}</div>
                    <div style={{ fontSize: 11, color: '#8a8a8a' }}>per mile · {CAR.electricUsePerMile} kWh/mi</div>
                  </div>
                  <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.25)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, color: '#8a8a8a', marginBottom: 4 }}>Gasoline mode</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#ff9800', fontVariantNumeric: 'tabular-nums' }}>{fmtCents(gasCostMile)}</div>
                    <div style={{ fontSize: 11, color: '#8a8a8a' }}>per mile · {CAR.gasMpg} MPG</div>
                  </div>
                  <div style={{ background: winner === 'electric' ? 'rgba(76,175,80,0.12)' : 'rgba(255,152,0,0.12)', border: `1px solid ${winner === 'electric' ? 'rgba(76,175,80,0.35)' : 'rgba(255,152,0,0.35)'}`, borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, color: '#8a8a8a', marginBottom: 4 }}>You save</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: winner === 'electric' ? '#66bb6a' : '#ffcc80', fontVariantNumeric: 'tabular-nums' }}>{fmtCents(perMileSavings)}</div>
                    <div style={{ fontSize: 11, color: '#8a8a8a' }}>per mile · {pctSavings.toFixed(0)}% cheaper</div>
                  </div>
                </div>
              </div>

              {/* Blended + annual */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', marginTop: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#ffcc80', margin: '0 0 12px' }}>Your blended cost at {share}% electric driving</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 34, fontWeight: 700, color: '#ffcc80', fontVariantNumeric: 'tabular-nums' }}>{fmtCents(blendedCostMile)}</span>
                  <span style={{ fontSize: 13, color: '#8a8a8a' }}>per mile blended</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#a0a0a0', lineHeight: 1.6 }}>
                  At {CAR.annualMiles.toLocaleString()} mi/yr you'd pay <strong style={{ color: '#e0e0e0' }}>{fmtMoney(annualBlendedCost)}</strong> blended vs{' '}
                  <strong style={{ color: '#e0e0e0' }}>{fmtMoney(annualGasCost)}</strong> driving gas-only for everything — saving about{' '}
                  <strong style={{ color: annualSavings > 0 ? '#66bb6a' : '#e0e0e0' }}>{fmtMoney(annualSavings)} /yr</strong>.
                </p>
              </div>

              {/* Why */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.5rem,3vw,2rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', marginTop: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#ffcc80', margin: '0 0 12px' }}>Why</h3>
                <p style={{ margin: '0 0 10px', fontSize: 15, lineHeight: 1.7, color: '#e0c9a8' }}>
                  Your Clarity PHEV draws <strong>{CAR.electricUsePerMile} kWh per mile</strong> (EPA lists it at{' '}
                  <strong>31 kWh/100 mi</strong>, i.e. <strong>{(1 / CAR.electricUsePerMile).toFixed(1)} miles per kWh</strong>,{' '}
                  <strong>{110} MPGe</strong>) in EV mode. At <strong>${kwhP.toFixed(2)}/kWh</strong>, that is{' '}
                  <strong>{fmtCents(electricCostMile)} per mile</strong>.
                </p>
                <p style={{ margin: '0 0 10px', fontSize: 15, lineHeight: 1.7, color: '#e0c9a8' }}>
                  Once the <strong>{CAR.evRange}-mile</strong> electric range is used up, the engine takes over and averages{' '}
                  <strong>{CAR.gasMpg} MPG</strong>. At <strong>${gasP.toFixed(2)}/gallon</strong>, that is{' '}
                  <strong>{fmtCents(gasCostMile)} per mile</strong>.
                </p>
                <p style={{ margin: '0 0 0', fontSize: 15, lineHeight: 1.7, color: '#e0c9a8' }}>
                  {winner === 'electric'
                    ? `Electric mode wins by ${fmtCents(perMileSavings)}/mile (${pctSavings.toFixed(0)}% cheaper). Battery-only driving is the sweet spot for a PHEV — every short trip under ${CAR.evRange} mi is almost free to run.`
                    : `Gasoline mode wins by ${fmtCents(perMileSavings)}/mile (${pctSavings.toFixed(0)}% cheaper) at these prices. Electricity looks cheap but your local rate makes per-mile EV driving pricier than gas.`}
                </p>
              </div>
            </>
          )}

          {/* Source */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: 'clamp(1.25rem,3vw,1.75rem)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)', marginTop: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a8a', margin: '0 0 8px' }}>Source</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#a0a0a0' }}>
              EPA figures for the <strong>{CAR.name}</strong> — {CAR.gasMpg} MPG combined gas, {CAR.electricUsePerMile * 100} kWh/100 mi electric,{' '}
              {CAR.evRange}-mile EV range (fueleconomy.gov,{' '}
              <a href="https://www.fueleconomy.gov/feg/Find.do?action=sbs&id=39782" target="_blank" rel="noopener noreferrer" style={{ color: '#ff9800' }}>2018/2021 Clarity Plug-in Hybrid</a>
              ). Battery capacity 17 kWh. Estimates assume {CAR.annualMiles.toLocaleString()} mi/yr.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,152,0,0.25)', borderRadius: 10,
  color: '#e0e0e0', fontSize: 15, padding: '10px 12px', fontFamily: 'inherit', outline: 'none',
  colorScheme: 'dark',
}
