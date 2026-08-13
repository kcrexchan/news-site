/**
 * Post-build script: converts flat Next.js static export files into directory-based routes.
 * Next.js exports /digest.jsx → out/digest.html, but we need out/digest/index.html for proper routing.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');

// Pages that should become directory-based routes (not just flat .html files)
const DIR_ROUTES = ['digest', 'tetris', 'breakout', 'reddit', 'income', 'heads-up'];

for (const route of DIR_ROUTES) {
  const flatPath = path.join(OUT_DIR, `${route}.html`);
  const dirPath = path.join(OUT_DIR, route);
  const indexPath = path.join(dirPath, 'index.html');

  if (!fs.existsSync(flatPath)) continue;

  // Create directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Copy flat file to index.html inside the directory
  fs.copyFileSync(flatPath, indexPath);
  
  console.log(`✓ ${route}.html → ${route}/index.html`);
}

console.log('Post-build complete.');
