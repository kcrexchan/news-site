import React from 'react';
import Head from 'next/head';

export default function ErnestBirthday() {
  return (
    <>
      <Head>
        <title>生日快樂 Ernest 🎂 · Happy Birthday!</title>
      </Head>
      <iframe
        src="/ernest-birthday.html"
        style={{ width: '100vw', height: '100vh', border: 'none' }}
        title="Ernest Birthday"
      />
    </>
  );
}
