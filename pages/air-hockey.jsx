import Head from 'next/head'
import { useRouter } from 'next/router'

export default function AirHockeyPage() {
  const router = useRouter()
  return (
    <>
      <Head><title>Air Hockey 🏒</title></Head>
      <div style={{position:'relative', width:'100vw', height:'100vh'}}>
        <button onClick={() => router.back()} style={{position:'fixed',top:16,left:16,zIndex:9999,padding:'8px 14px',fontSize:'14px',fontWeight:600,background:'rgba(20,26,46,0.9)',color:'#e0e8ff',border:'1px solid rgba(58,134,255,0.3)',borderRadius:'10px',cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,0.4)',transition:'background 0.2s, border-color 0.2s'}}>
          ← Back
        </button>
        <iframe src="/air-hockey.html" style={{width:'100vw',height:'100vh',border:'none'}} title="Air Hockey Game" />
      </div>
    </>
  )
}
