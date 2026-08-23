import Head from 'next/head'
import { useRouter } from 'next/router'

export default function SkeeBallPage() {
  const router = useRouter()
  return (
    <>
      <Head><title>Skee-Ball 🎳</title></Head>
      <div style={{position:'relative', width:'100vw', height:'100vh', display:'flex', flexDirection:'column'}}>
        <button onClick={() => router.back()} style={{position:'fixed',top:16,left:16,zIndex:9999,padding:'10px 20px',fontSize:'18px',fontWeight:'bold',background:'rgba(0,0,0,0.85)',color:'#fff',border:'2px solid rgba(255,255,255,0.3)',borderRadius:'10px',cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>
          ← Back
        </button>
        <iframe src="/skee-ball-game.html" style={{width:'100%',flex:'1 1 auto',border:'none',minHeight:0}} title="Skee-Ball Game" />
      </div>
    </>
  )
}
