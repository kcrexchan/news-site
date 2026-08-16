/** @type {import('next').NextConfig} */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Use the actual build time — reflects when npm run build was executed
const buildTime = new Date().toISOString()

// Git commit short hash as version
let gitHash = 'unknown'
try {
  gitHash = execSync('git log -1 --format=%h', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
} catch {
  // fallback if git is unavailable
}

// ─── Stamp the static homepage (public/index.html) ─────────────────────
// public/index.html shadows the React root page in the export, so the
// clock text must be baked in at build time. Replace the __BUILD_TIME__
// placeholder with the human-readable deploy timestamp.
const homepage = path.join(__dirname, 'public', 'index.html')
if (fs.existsSync(homepage)) {
  const html = fs.readFileSync(homepage, 'utf-8')
  if (html.includes('__BUILD_TIME__')) {
    const d = new Date()
    const stamp =
      d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
      ' \u00b7 Updated at ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    fs.writeFileSync(homepage, html.split('__BUILD_TIME__').join(stamp), 'utf-8')
    console.log(`\u2713 stamped public/index.html build time: ${stamp}`)
  }
}

const nextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_VERSION: gitHash,
  },
}

module.exports = nextConfig
