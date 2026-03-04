import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { typedRoutes: false },
  async headers() {
    return [
      {
        // Prevent stale HTML from referencing old chunk hashes after deploy/restart.
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ]
  },
}

export default nextConfig
