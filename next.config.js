/** @type {import('next').NextConfig} */
const { execSync } = require('child_process')

// Use the last git commit date as the timestamp — reflects when code was pushed/merged
let commitTime = new Date().toISOString()
try {
  commitTime = execSync('git log -1 --format=%aI', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
} catch {
  // fallback to now if git is unavailable
}

const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: commitTime,
  },
}

module.exports = nextConfig
