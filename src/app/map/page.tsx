import type { Metadata } from 'next';
import { getAllGanpatis, getAreas, getFestivalConfig } from '@/services/ganpati';
import { isVisarjanImminent } from '@/lib/festival';
import { MapView } from '@/features/map/MapView';

export const metadata: Metadata = {
  title: 'Map',
  description:
    'Every Pune Ganpati mandal on one map — filter by area, find what is near you, and open directions.',
  alternates: { canonical: '/map' },
};

export const revalidate = 3600;

export default async function MapPage() {
  const [ganpatis, areas, festival] = await Promise.all([
    getAllGanpatis(),
    getAreas(),
    getFestivalConfig(),
  ]);

  return (
    <main id="main">
      <h1 className="sr-only">Map of Pune Ganpati mandals</h1>
      <MapView ganpatis={ganpatis} areas={areas} showVisarjan={isVisarjanImminent(festival)} />
    </main>
  );
}
