import Head from 'next/head'

export default function HeadsUpPage() {
  return (
    <>
      <Head><title>Heads Up! 📱</title></Head>
      <iframe src="/heads-up-game.html" style={{width:'100vw',height:'100vh',border:'none'}} title="Heads Up Game" />
    </>
  )
}
