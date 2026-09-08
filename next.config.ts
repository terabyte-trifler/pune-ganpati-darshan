import type { NextConfig } from 'next';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * A value that changes on every build.
 *
 * The service worker uses it to version its caches. Without something that
 * changes, `sw.js` is byte-identical across deploys, so the browser never
 * reinstalls it, `activate` never runs, and the cache-cleanup code that
 * looks so reassuring in that file is dead — old shell HTML and every
 * build's chunks accumulate indefinitely.
 *
 * Git SHA where available so two builds of the same commit agree; the
 * timestamp is only a fallback for a tree with no git.
 */
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return Date.now().toString(36);
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId() },

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
