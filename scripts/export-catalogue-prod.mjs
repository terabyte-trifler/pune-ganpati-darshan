/**
 * Regenerates src/content/catalogue.json from PRODUCTION, over PostgREST.
 *
 * export-catalogue.sh does the same job in SQL, but it needs a direct
 * Postgres connection and defaults to a LOCAL seeded database — pointing
 * it at the wrong one is how production edits got overwritten before.
 * This reads the same tables through the REST API with the service key,
 * so the only database it can reach is the one in .env.local.
 *
 * It reproduces the shapes that script emits, field for field, because
 * this file is the offline fallback the app serves when Supabase is
 * unreachable and the service worker caches: a shape that drifts from the
 * live one is a bug nobody sees until the network fails.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) throw new Error('missing Supabase env');

const get = async (path) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
};

const strip = (o, keys) => {
  const out = { ...o };
  for (const k of keys) delete out[k];
  return out;
};
const TS = ['created_at', 'updated_at'];

const [areasRaw, categoriesRaw, festivalRaw, ganpatisRaw, routesRaw, stopsRaw, imagesRaw] =
  await Promise.all([
    get('areas?select=*&order=sort_order'),
    get('categories?select=*&order=sort_order'),
    get('festival_config?select=*&is_active=eq.true&limit=1'),
    get('ganpatis?select=*&published=eq.true&order=prominence.desc'),
    get('routes?select=*&published=eq.true&order=sort_order'),
    get('route_stops?select=route_id,position,darshan_minutes,darshan_style,note,ganpati_id&order=position'),
    get('ganpati_images?select=*&order=sort_order'),
  ]);

const areaById = new Map(areasRaw.map((a) => [a.id, a]));
const slugById = new Map(ganpatisRaw.map((g) => [g.id, g.slug]));
const imagesByGanpati = new Map();
for (const i of imagesRaw) {
  const list = imagesByGanpati.get(i.ganpati_id) ?? [];
  list.push(strip(i, [...TS, 'ganpati_id']));
  imagesByGanpati.set(i.ganpati_id, list);
}
const stopsByRoute = new Map();
for (const st of stopsRaw) {
  const list = stopsByRoute.get(st.route_id) ?? [];
  list.push({
    ganpati_slug: slugById.get(st.ganpati_id),
    position: st.position,
    darshan_minutes: st.darshan_minutes,
    darshan_style: st.darshan_style,
    note: st.note,
  });
  stopsByRoute.set(st.route_id, list);
}

const catalogue = {
  generatedAt: new Date().toISOString(),
  festival: festivalRaw[0] ? strip(festivalRaw[0], ['id', ...TS]) : null,
  areas: areasRaw.map((a) => strip(a, TS)),
  categories: categoriesRaw.map((c) => strip(c, TS)),
  routes: routesRaw.map((r) => ({
    ...strip(r, TS),
    stops: (stopsByRoute.get(r.id) ?? []).sort((a, b) => a.position - b.position),
  })),
  ganpatis: ganpatisRaw.map((g) => {
    const area = areaById.get(g.area_id);
    return {
      ...strip(g, [...TS, 'area_id']),
      area_slug: area?.slug ?? null,
      area_name: area?.name ?? null,
      area_name_mr: area?.name_mr ?? null,
      area_is_core: area?.is_core ?? null,
      images: imagesByGanpati.get(g.id) ?? [],
    };
  }),
};

writeFileSync('src/content/catalogue.json', JSON.stringify(catalogue, null, 2) + '\n');
console.log(
  `wrote catalogue.json: ${catalogue.ganpatis.length} ganpatis, ` +
  `${catalogue.areas.length} areas, ${catalogue.routes.length} routes`
);
