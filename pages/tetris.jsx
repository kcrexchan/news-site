import Head from 'next/head'
import { useRouter } from 'next/router'

export default function TetrisPage() {
  const router = useRouter()
  return (
    <>
      <Head><title>Tetris 🌿</title></Head>
      <div style={{position:'relative', width:'100vw', height:'100vh', display:'flex', flexDirection:'column'}}>
        <button onClick={() => router.back()} style={{position:'fixed',top:16,left:16,zIndex:9999,padding:'10px 20px',fontSize:'18px',fontWeight:'bold',background:'rgba(0,0,0,0.85)',color:'#fff',border:'2px solid rgba(255,255,255,0.3)',borderRadius:'10px',cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>
          ← Back
        </button>
        <iframe src="/tetris-game.html" style={{width:'100%',flex:'1 1 auto',border:'none',minHeight:0}} title="Tetris Game" />
        <footer id="consent-footer" className="consent-footer" style={{flexShrink:0,padding:'8px 16px 10px',textAlign:'center',fontSize:'11px',lineHeight:'1.5',color:'#8b90a0',background:'rgba(10,10,10,0.95)',borderTop:'1px solid rgba(128,128,128,0.15)'}}>
          By submitting a score you consent to us storing your IP address, browser user-agent, and timestamp with your entry (GDPR/CCPA).
          See our <a href="/privacy" style={{color:'#9aa0ff',textDecoration:'none'}}><u>Privacy Policy</u></a>.
        </footer>
        <style>{`
          .consent-footer.consent-accepted { display:none !important; }
        `}</style>
      </div>
    </>
  )
}
