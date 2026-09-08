'use client';

import { useEffect, useRef, useState } from 'react';
import { MarkerClusterer, type Marker } from '@googlemaps/markerclusterer';
import { loadMaps, type MapsLoadResult } from '@/lib/maps/maps-client';
import { DARK_MAP_STYLE } from '@/lib/maps/dark-style';
import { buildMarkerSvg, buildClusterSvg } from '@/lib/maps/markers';
import { PUNE_CENTER, PETH_BOUNDS, boundsOf, type LatLng } from '@/lib/geo';
import { env } from '@/lib/env';
import type { Ganpati } from '@/types/ganpati';

/**
 * The Google map.
 *
 * Imperative by necessity: markers are managed outside React so that
 * selecting one does not re-render the whole list, and panning never
 * re-creates marker instances. React owns *which* mandals are shown; this
 * component owns the map objects.
 */

export interface MapCanvasProps {
  ganpatis: Ganpati[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  userLocation: LatLng | null;
  onLoadResult?: (result: MapsLoadResult) => void;
}

export function MapCanvas({
  ganpatis, selectedSlug, onSelect, userLocation, onLoadResult,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef(new Map<string, google.maps.Marker>());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Keep the latest onSelect without re-running the map setup effect.
  // Assigned in an effect (not during render) so concurrent rendering
  // cannot observe a torn value; markers are created in effects that run
  // after this one on the first commit.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /* ---------------- Map creation (once) ---------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await loadMaps();
      onLoadResult?.(result);
      if (!result.ok || cancelled || !containerRef.current) return;

      const mapId = env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
      const map = new google.maps.Map(containerRef.current, {
        center: PUNE_CENTER,
        zoom: 14,
        // A cloud Map ID and inline styles are mutually exclusive; prefer
        // the Map ID when configured.
        ...(mapId ? { mapId } : { styles: DARK_MAP_STYLE }),
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'greedy',
        clickableIcons: false,
        backgroundColor: '#14100c',
        maxZoom: 19,
        minZoom: 11,
      });

      // Tapping empty map clears the selection.
      map.addListener('click', () => onSelectRef.current(null));

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [onLoadResult]);

  /* ---------------- Markers ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const markers = markersRef.current;
    const wanted = new Set(ganpatis.map((g) => g.slug));

    // Remove markers no longer in the filtered set.
    for (const [slug, marker] of markers) {
      if (!wanted.has(slug)) {
        marker.setMap(null);
        markers.delete(slug);
      }
    }

    // Add markers that are new.
    for (const g of ganpatis) {
      if (markers.has(g.slug)) continue;
      const visual = buildMarkerSvg(g.category, false);
      const marker = new google.maps.Marker({
        position: { lat: g.location.lat, lng: g.location.lng },
        title: g.name,
        icon: {
          url: visual.url,
          scaledSize: new google.maps.Size(visual.size, visual.size),
          anchor: new google.maps.Point(visual.size / 2, visual.size / 2),
        },
        optimized: true,
      });
      marker.addListener('click', () => onSelectRef.current(g.slug));
      markers.set(g.slug, marker);
    }

    // Rebuild the clusterer against the current marker set.
    clustererRef.current?.clearMarkers();
    clustererRef.current = new MarkerClusterer({
      map,
      markers: [...markers.values()] as Marker[],
      renderer: {
        render: ({ count, position }) => {
          const visual = buildClusterSvg(count);
          return new google.maps.Marker({
            position,
            icon: {
              url: visual.url,
              scaledSize: new google.maps.Size(visual.size, visual.size),
              anchor: new google.maps.Point(visual.size / 2, visual.size / 2),
            },
            // Keep clusters above individual pins.
            zIndex: 1000 + count,
          });
        },
      },
    });

    return () => {
      clustererRef.current?.clearMarkers();
    };
  }, [ganpatis, ready]);

  /* ---------------- Selection ---------------- */
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    for (const g of ganpatis) {
      const marker = markersRef.current.get(g.slug);
      if (!marker) continue;
      const selected = g.slug === selectedSlug;
      const visual = buildMarkerSvg(g.category, selected);
      marker.setIcon({
        url: visual.url,
        scaledSize: new google.maps.Size(visual.size, visual.size),
        anchor: new google.maps.Point(visual.size / 2, visual.size / 2),
      });
      marker.setZIndex(selected ? 9999 : undefined);
    }

    if (selectedSlug) {
      const g = ganpatis.find((x) => x.slug === selectedSlug);
      if (g) {
        map.panTo({ lat: g.location.lat, lng: g.location.lng });
        if ((map.getZoom() ?? 0) < 16) map.setZoom(16);
      }
    }
  }, [selectedSlug, ganpatis, ready]);

  /* ---------------- Fit to the filtered set ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || ganpatis.length === 0 || selectedSlug) return;

    const b = ganpatis.length === 1
      ? PETH_BOUNDS
      : boundsOf(ganpatis.map((g) => ({ lat: g.location.lat, lng: g.location.lng })));

    map.fitBounds(
      new google.maps.LatLngBounds(
        { lat: b.south, lng: b.west },
        { lat: b.north, lng: b.east }
      ),
      // Leave room for the search pill on top and the sheet at the bottom.
      { top: 90, right: 40, bottom: 180, left: 40 }
    );
    // Intentionally not reacting to selectedSlug changes — refitting on
    // every selection would fight the pan above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganpatis, ready]);

  /* ---------------- User location ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    if (!userLocation) {
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      return;
    }

    const icon = {
      url:
        'data:image/svg+xml,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
             <circle cx="11" cy="11" r="10" fill="#4E8A5B" opacity="0.25"/>
             <circle cx="11" cy="11" r="5" fill="#6fc47f" stroke="#14100c" stroke-width="2"/>
           </svg>`
        ),
      scaledSize: new google.maps.Size(22, 22),
      anchor: new google.maps.Point(11, 11),
    };

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(userLocation);
    } else {
      userMarkerRef.current = new google.maps.Marker({
        position: userLocation,
        map,
        icon,
        title: 'Your location',
        zIndex: 5000,
      });
    }
  }, [userLocation, ready]);

  return <div ref={containerRef} className="absolute inset-0 bg-[var(--raat)]" aria-label="Map of Pune Ganpati mandals" role="application" />;
}
