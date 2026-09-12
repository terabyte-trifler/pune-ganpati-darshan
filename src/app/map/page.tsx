import type { Metadata } from 'next';
import { getAllGanpatis, getAreas } from '@/services/ganpati';
import { MapView } from '@/features/map/MapView';
import { DwellSignal } from '@/features/crowd/DwellSignal';

export const metadata: Metadata = {
  title: 'Map',
  description:
    'Every Pune Ganpati mandal on one map — filter by area, find what is near you, and open directions.',
  alternates: { canonical: '/map' },
};

export const revalidate = 3600;

export default async function MapPage() {
  const [ganpatis, areas] = await Promise.all([getAllGanpatis(), getAreas()]);

  // Shadow mode, off unless the flag is set. Read on the server so a
  // build with it off ships no collection at all rather than shipping
  // dormant code behind a client-side check.
  const dwellShadow = process.env.CROWD_DWELL_SHADOW === '1';

  return (
    <main id="main">
      <h1 className="sr-only">Map of Pune Ganpati mandals</h1>
      <MapView ganpatis={ganpatis} areas={areas} />
      {dwellShadow && (
        <DwellSignal
          enabled
          mandals={ganpatis.map((g) => ({
            id: g.id,
            lat: g.location.lat,
            lng: g.location.lng,
          }))}
        />
      )}
    </main>
  );
}
