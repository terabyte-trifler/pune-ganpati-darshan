'use client';

import { Navigation } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { trackEvent } from '@/services/analytics';
import type { Ganpati } from '@/types/ganpati';

/**
 * Hands off to a maps application for turn-by-turn navigation.
 *
 * We deliberately do NOT reimplement navigation: during the festival many
 * peth roads are closed to vehicles and pedestrianised, and Google Maps
 * has that live data where we do not. Using the universal URL means it
 * opens the native app when installed and the web otherwise.
 */
export function DirectionsButton({
  ganpati, className,
}: {
  ganpati: Ganpati;
  className?: string;
}) {
  const { lat, lng, googlePlaceId } = ganpati.location;

  const href = (() => {
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('destination', `${lat},${lng}`);
    // A place id makes the pin resolve to the mandal rather than a
    // nearby rooftop when Google has the place.
    if (googlePlaceId) {
      url.searchParams.set('destination_place_id', googlePlaceId);
    }
    // Walking is the default in the peths, where vehicles cannot go.
    url.searchParams.set('travelmode', ganpati.area.isCore ? 'walking' : 'driving');
    return url.toString();
  })();

  return (
    <Button
      asChild
      size="md"
      className={className}
      onClick={() =>
        trackEvent('directions_clicked', {
          ganpatiId: ganpati.id,
          props: { slug: ganpati.slug },
        })
      }
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Navigation size={16} aria-hidden="true" />
        Get directions
      </a>
    </Button>
  );
}
