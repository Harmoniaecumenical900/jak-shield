/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_SHIELD_API ?? 'http://localhost:4100'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
