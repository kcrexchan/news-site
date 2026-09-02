import React from 'react';
import Head from 'next/head';

export default function FloppyBird() {
  return (
    <>
      <Head>
        <title>Floppy Bird 🐦</title>
        <style>{`
          html, body { margin: 0; padding: 0; overflow: hidden; background: #061204; }
          .theme-toggle { display: none !important; }
        `}</style>
      </Head>
      <iframe
        src="/flappy-bird.html"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Floppy Bird"
      />
    </>
  );
}
