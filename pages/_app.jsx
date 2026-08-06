import React, { useEffect } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import '../styles/theme.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Theme toggle button handler — runs AFTER React mounts the button
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var current = document.body.getAttribute('data-theme') || 'dark';
      var newTheme = current === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      if (newTheme === 'dark') document.body.classList.add('dark-mode');
      else document.body.classList.remove('dark-mode');
      try { localStorage.setItem('app-theme', newTheme); } catch (e) {}
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('theme', newTheme);
        window.history.pushState({}, '', url);
      } catch (e) {}
    });
  }, []);

  return (
    <>
      <Head>
        {/* Client-side theme init: runs before paint, no flash of wrong theme */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var saved = localStorage.getItem('app-theme');
                var params = new URLSearchParams(window.location.search);
                var theme = params.get('theme') || saved || 'dark';
                document.body.setAttribute('data-theme', theme);
                if (theme === 'dark') document.body.classList.add('dark-mode');
                else document.body.classList.remove('dark-mode');
              } catch(e) {}
            })();
          `
        }} />
      </Head>

      {/* Theme toggle button (handled by useEffect above) */}
      <button
        className="theme-toggle"
        aria-label="Toggle dark/light mode"
      >
        <span className="icon-light">☀️</span>
        <span className="icon-dark">🌙</span>
      </button>

      <Component {...pageProps} />
    </>
  );
}
