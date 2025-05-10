/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
        pathname: '/*',
      },
    ],
    unoptimized: true,
  },
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: 'canvas' }];
    return config;
  },
  // Remove basePath if you're not specifically serving the app from a subdirectory
  // basePath: '/pdftochat',
};

module.exports = nextConfig;
