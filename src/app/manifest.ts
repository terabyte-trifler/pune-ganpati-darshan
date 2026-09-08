import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pune Ganpati Darshan',
    short_name: 'Pune Ganpati',
    description:
      "Find Pune's Ganpati mandals, see what's near you, and plan a walkable darshan route.",
    start_url: '/',
    display: 'standalone',
    background_color: '#14100C',
    theme_color: '#14100C',
    orientation: 'portrait',
    categories: ['travel', 'navigation', 'lifestyle'],
    lang: 'en-IN',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Map', url: '/map', description: 'Mandals near you on the map' },
      { name: 'Your darshan', url: '/plan', description: 'Your planned route' },
    ],
  };
}
