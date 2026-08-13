import Head from 'next/head'
import { useRouter } from 'next/router'

export default function TetrisPage() {
  const router = useRouter()
  return (
    <>
      <Head><title>Tetris 🌿</title></Head>
      <div style={{position:'relative', width:'100vw', height:'100vh'}}>
        <button onClick={() => router.push('/')} style={{position:'absolute',top:12,left:12,zIndex:10,padding:'8px 16px',fontSize:'16px',background:'rgba(0,0,0,0.7)',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer'}}>
          ← Home
        </button>
        <iframe src="/tetris-game.html" style={{width:'100%',height:'100%',border:'none'}} title="Tetris Game" />
      </div>
    </>
  )
}
