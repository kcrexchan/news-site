import Head from 'next/head'

export default function TetrisPage() {
  return (
    <>
      <Head><title>Tetris 🌿</title></Head>
      {/* Redirect to the self-contained HTML file */}
      <iframe src="/tetris-game.html" style={{width:'100vw',height:'100vh',border:'none'}} title="Tetris Game" />
    </>
  )
}
