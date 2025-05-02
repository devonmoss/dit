/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Re-enable ESLint during build
  eslint: {
    ignoreDuringBuilds: false,
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