import React from 'react';
import Head from 'next/head';

export default function MemoryMatch() {
  return (
    <>
      <Head>
        <title>Memory Match 🃏</title>
      </Head>
      <iframe
        src="/memory-match.html"
        style={{ width: '100vw', height: '100vh', border: 'none' }}
        title="Memory Match"
      />
    </>
  );
}
