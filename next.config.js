/** @type {import('next').NextConfig} */
const { execSync } = require('child_process')

// Use the actual build time — reflects when npm run build was executed
const buildTime = new Date().toISOString()

// Git commit short hash as version
let gitHash = 'unknown'
try {
  gitHash = execSync('git log -1 --format=%h', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
} catch {
  // fallback if git is unavailable
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_VERSION: gitHash,
  },
}

module.exports = nextConfig
