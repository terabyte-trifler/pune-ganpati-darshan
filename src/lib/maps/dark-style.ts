/**
 * Custom dark map style.
 *
 * Tuned so the map recedes and the mandal markers dominate: roads are
 * barely lighter than the ground, POIs are suppressed almost entirely
 * (a festival visitor does not need ATMs), and water/parks carry just
 * enough hue to orient someone against the river and Sarasbaug.
 *
 * Used only when no Map ID is configured. With NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
 * set, styling comes from the cloud-managed style instead — which is what
 * AdvancedMarkerElement requires.
 */
export const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#14100c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a7f6d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#14100c' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // Suppress commercial noise; keep places of worship and parks.
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi.place_of_worship',
    elementType: 'geometry',
    stylers: [{ color: '#2a2119' }, { visibility: 'on' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1c2a1e' }, { visibility: 'on' }],
  },

  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#241d16' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6d6354' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2b231a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a2e20' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1418' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d4a52' }] },

  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2e261d' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#191410' }] },
];
