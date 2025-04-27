/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/login',
        permanent: true,
      },
    ]
  }
}

module.exports = nextConfig 