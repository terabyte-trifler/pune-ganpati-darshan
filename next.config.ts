import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // The project sits inside a parent directory that is itself a git repo;
  // pin the workspace root so Next does not walk up into the home directory.
  turbopack: { root: path.resolve(__dirname) },

  images: {
    // Production mandal photography is served from Supabase Storage.
    // Remote patterns are explicit — never a wildcard host.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
