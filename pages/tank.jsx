import Head from 'next/head'

export default function TankPage() {
  return (
    <>
      <Head><title>Tank Battle ⚔️</title></Head>
      <iframe src="/tank-battle.html" style={{width:'100vw',height:'100vh',border:'none'}} title="Tank Battle Game" />
    </>
  )
}
