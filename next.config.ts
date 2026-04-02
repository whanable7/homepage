import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/artworks',
        destination: '/portfolio',
        permanent: true,
      },
      {
        source: '/artworks/:slug',
        destination: '/portfolio/:slug',
        permanent: true,
      },
      {
        source: '/about',
        destination: '/cv',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
