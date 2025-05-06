/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Re-enable ESLint during build
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // Enable detailed source maps for better debugging
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.devtool = 'eval-source-map';
    }
    return config;
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