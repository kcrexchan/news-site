import React from 'react';
import Head from 'next/head';

export default function FloppyBird() {
  return (
    <>
      <Head>
        <title>Floppy Bird 🐦</title>
      </Head>
      <iframe
        src="/flappy-bird.html"
        style={{ width: '100vw', height: '100vh', border: 'none' }}
        title="Floppy Bird"
      />
    </>
  );
}
