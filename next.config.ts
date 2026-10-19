import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/portfolio", destination: "/works", permanent: true },
      {
        source: "/portfolio/graph",
        destination: "/works?view=ecosystem",
        permanent: true,
      },
      {
        source: "/portfolio/mindmap",
        destination: "/works?view=ecosystem",
        permanent: true,
      },
      {
        source: "/portfolio/colors",
        destination: "/works?view=strata",
        permanent: true,
      },
      {
        source: "/portfolio/years",
        destination: "/works?view=years",
        permanent: true,
      },
      {
        source: "/portfolio/:slug",
        destination: "/works/:slug",
        permanent: true,
      },
      {
        source: "/artworks",
        destination: "/works",
        permanent: true,
      },
      {
        source: "/artworks/:slug",
        destination: "/works/:slug",
        permanent: true,
      },
      {
        source: "/about",
        destination: "/cv",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
