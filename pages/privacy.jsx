import Head from 'next/head'
import { useRouter } from 'next/router'

export default function PrivacyPage() {
  const router = useRouter()
  return (
    <>
      <Head><title>Privacy Policy · llm.xerex.us</title></Head>
      <div style={{minHeight:'100vh', background:'var(--bg-main)', color:'var(--text-primary)', padding:'48px 20px'}}>
        <div style={{maxWidth:'720px', margin:'0 auto', background:'var(--bg-card)', border:'1px solid rgba(128,128,128,0.15)', borderRadius:'16px', padding:'40px 44px', boxShadow:'0 4px 24px rgba(0,0,0,0.25)'}}>
          <button onClick={() => router.back()} style={{padding:'8px 18px', fontSize:'14px', fontWeight:'bold', background:'rgba(0,0,0,0.35)', color:'var(--text-primary)', border:'1px solid rgba(128,128,128,0.3)', borderRadius:'10px', cursor:'pointer', marginBottom:'28px'}}>
            ← Back
          </button>

          <h1 style={{fontSize:'30px', margin:'0 0 6px', letterSpacing:'0.5px'}}>Privacy Policy</h1>
          <p style={{color:'var(--text-secondary)', fontSize:'14px', margin:'0 0 28px'}}>Last updated: August 19, 2026 · Applies to llm.xerex.us and news-site.kcrexchan.workers.dev</p>

          <h2 style={{fontSize:'19px', margin:'26px 0 10px'}}>1. What we collect</h2>
          <p style={{lineHeight:'1.7', margin:'0 0 14px'}}>When you submit a score to the Tetris leaderboard, we store the following alongside your entry:</p>
          <ul style={{lineHeight:'1.8', margin:'0 0 14px', paddingLeft:'22px'}}>
            <li>Your IP address</li>
            <li>Browser user-agent string</li>
            <li>The timestamp of the submission</li>
          </ul>
          <p style={{lineHeight:'1.7', margin:'0 0 14px'}}>We also store the name you choose (or the default "PLAYER"), your score, level reached, and lines cleared.</p>

          <h2 style={{fontSize:'19px', margin:'26px 0 10px'}}>2. Why we collect it</h2>
          <p style={{lineHeight:'1.7', margin:'0 0 14px'}}>The IP address, user-agent, and timestamp are recorded for fraud prevention (to deter bot or duplicate score submissions) and basic security logging. They are <strong>never displayed</strong> on the public leaderboard.</p>

          <h2 style={{fontSize:'19px', margin:'26px 0 10px'}}>3. How long we keep it</h2>
          <p style={{lineHeight:'1.7', margin:'0 0 14px'}}>The leaderboard holds only the top 10 entries. When your entry falls off the board, its associated metadata is removed with it.</p>

          <h2 style={{fontSize:'19px', margin:'26px 0 10px'}}>4. Where it is stored</h2>
          <p style={{lineHeight:'1.7', margin:'0 0 14px'}}>Data is stored in a private Cloudflare R2 bucket and is not shared with third parties, sold, or used for advertising.</p>

          <h2 style={{fontSize:'19px', margin:'26px 0 10px'}}>5. Your rights (GDPR / CCPA)</h2>
          <p style={{lineHeight:'1.7', margin:'0 0 14px'}}>If you are in the EU (GDPR) or California (CCPA), you have the right to:</p>
          <ul style={{lineHeight:'1.8', margin:'0 0 14px', paddingLeft:'22px'}}>
            <li>Access the personal data we hold about you</li>
            <li>Request correction or deletion of your data</li>
            <li>Object to processing or request data portability</li>
          </ul>
          <p style={{lineHeight:'1.7', margin:'0 0 14px'}}>To exercise any of these rights, contact us at <a href="mailto:kcrexchan@gmail.com" style={{color:'#9aa0ff', textDecoration:'none'}}>kcrexchan@gmail.com</a>.</p>

          <h2 style={{fontSize:'19px', margin:'26px 0 10px'}}>6. Cookies &amp; local storage</h2>
          <p style={{lineHeight:'1.7', margin:'0 0 14px'}}>This site uses browser <code>localStorage</code> to remember your theme preference and (as an offline fallback) your local leaderboard. We do not use tracking cookies or third-party analytics.</p>

          <h2 style={{fontSize:'19px', margin:'26px 0 10px'}}>7. Contact</h2>
          <p style={{lineHeight:'1.7', margin:'0'}}>Questions about this policy or your data: <a href="mailto:kcrexchan@gmail.com" style={{color:'#9aa0ff', textDecoration:'none'}}>kcrexchan@gmail.com</a></p>
        </div>
      </div>
    </>
  )
}
