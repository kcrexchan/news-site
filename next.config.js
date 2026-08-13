/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenNext handles the build output — no static export needed
  // Inject build timestamp at build time (available as process.env.NEXT_PUBLIC_BUILD_TIME)
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
}

module.exports = nextConfig
