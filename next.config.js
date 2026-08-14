/** @type {import('next').NextConfig} */

// Use the actual build time — reflects when npm run build was executed
const buildTime = new Date().toISOString()

const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
}

module.exports = nextConfig
