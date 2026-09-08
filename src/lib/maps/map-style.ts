import type { StyleSpecification } from 'maplibre-gl';

/**
 * Dark map style, authored against OpenFreeMap's vector tiles.
 *
 * Written from scratch rather than recolouring an off-the-shelf theme so the
 * map uses the same pigment palette as the rest of the app (see globals.css)
 * — warm brown-black ground, muted lanes, marigold labels. The map has to
 * recede so the mandal markers dominate.
 *
 * OpenFreeMap serves OpenMapTiles-schema tiles with no API key, no account
 * and no usage limit, which is why this app needs no map billing at all.
 * Attribution to OpenStreetMap contributors is required and is rendered by
 * the AttributionControl.
 */

const TILES = 'https://tiles.openfreemap.org/planet';

/** Palette mirrors the CSS design tokens; kept literal because MapLibre
 *  cannot read CSS custom properties. */
const C = {
  ground: '#14100c',
  water: '#0e1418',
  park: '#1a2a1c',
  building: '#1d1712',
  laneMinor: '#241d16',
  laneMajor: '#2b231a',
  highway: '#3a2e20',
  rail: '#221c15',
  label: '#8a7f6d',
  labelHalo: '#14100c',
  waterLabel: '#3d4a52',
  boundary: '#2e261d',
} as const;

export const DARK_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openfreemap: { type: 'vector', url: TILES },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': C.ground } },

    {
      id: 'landcover',
      type: 'fill',
      source: 'openfreemap',
      'source-layer': 'landcover',
      paint: { 'fill-color': C.park, 'fill-opacity': 0.5 },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'openfreemap',
      'source-layer': 'park',
      paint: { 'fill-color': C.park, 'fill-opacity': 0.65 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openfreemap',
      'source-layer': 'water',
      paint: { 'fill-color': C.water },
    },

    // Buildings appear late; at low zoom they turn the peths into a smudge.
    {
      id: 'building',
      type: 'fill',
      source: 'openfreemap',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-color': C.building,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 0.8],
      },
    },

    {
      id: 'rail',
      type: 'line',
      source: 'openfreemap',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'rail'],
      paint: { 'line-color': C.rail, 'line-width': 1 },
    },

    // Roads, thinnest first so wider classes draw on top.
    {
      id: 'road-minor',
      type: 'line',
      source: 'openfreemap',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track', 'path']]],
      minzoom: 13,
      paint: {
        'line-color': C.laneMinor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 6],
      },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'openfreemap',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
      paint: {
        'line-color': C.laneMajor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 18, 10],
      },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: 'openfreemap',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'trunk', 'motorway']]],
      paint: {
        'line-color': C.highway,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 18, 14],
      },
    },

    {
      id: 'boundary',
      type: 'line',
      source: 'openfreemap',
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 6],
      paint: { 'line-color': C.boundary, 'line-width': 0.8, 'line-dasharray': [3, 2] },
    },

    // Street names only once genuinely zoomed in; the peth lanes are dense
    // and labelling them earlier competes with the markers.
    {
      id: 'road-label',
      type: 'symbol',
      source: 'openfreemap',
      'source-layer': 'transportation_name',
      minzoom: 15,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'symbol-placement': 'line',
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'water-label',
      type: 'symbol',
      source: 'openfreemap',
      'source-layer': 'water_name',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Italic'],
        'text-size': 11,
      },
      paint: { 'text-color': C.waterLabel, 'text-halo-color': C.labelHalo, 'text-halo-width': 1 },
    },
    {
      id: 'place-label',
      type: 'symbol',
      source: 'openfreemap',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'neighbourhood']]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 16, 13],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
      },
      paint: { 'text-color': C.label, 'text-halo-color': C.labelHalo, 'text-halo-width': 1.4 },
    },
  ],
};

export const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>';
