/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
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