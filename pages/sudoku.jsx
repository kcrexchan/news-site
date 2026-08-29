import React from 'react';
import Head from 'next/head';

export default function Sudoku() {
  return (
    <>
      <Head>
        <title>Sudoku 🔢</title>
      </Head>
      <iframe
        src="/sudoku.html"
        style={{ width: '100vw', height: '100vh', border: 'none' }}
        title="Sudoku"
      />
    </>
  );
}
