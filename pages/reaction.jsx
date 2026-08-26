import Head from 'next/head'
import { useRouter } from 'next/router'

export default function ReactionPage() {
  const router = useRouter()
  return (
    <>
      <Head><title>Reaction Time ⚡</title></Head>
      <div style={{position:'relative', width:'100vw', height:'100vh'}}>
        <button onClick={() => router.back()} style={{position:'fixed',top:16,left:16,zIndex:9999,padding:'10px 20px',fontSize:'18px',fontWeight:'bold',background:'rgba(0,0,0,0.85)',color:'#fff',border:'2px solid rgba(255,255,255,0.3)',borderRadius:'10px',cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>
          ← Back
        </button>
        <iframe src="/reaction-game.html" style={{width:'100%',height:'100%',border:'none'}} title="Reaction Time Game" />
      </div>
    </>
  )
}
