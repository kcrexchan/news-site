import React from 'react';
import Head from 'next/head';

export default function TicTacToe() {
  return (
    <>
      <Head>
        <title>Tic-Tac-Toe ❌⭕</title>
      </Head>
      <iframe
        src="/tic-tac-toe.html"
        style={{ width: '100vw', height: '100vh', border: 'none' }}
        title="Tic-Tac-Toe"
      />
    </>
  );
}
