import React from 'react';
import Head from 'next/head';

export default function FloppyBird() {
  return (
    <>
      <Head>
        <title>Floppy Bird 🐦</title>
        <style key="flappy-fullscreen">{`
          html, body, #__next {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            background: #061204 !important;
          }
          .theme-toggle { display: none !important; }
        `}</style>
      </Head>
      <iframe
        src="/flappy-bird.html"
        scrolling="no"
        allowFullScreen
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          overflow: 'hidden',
        }}
        title="Floppy Bird"
      />
    </>
  );
}
