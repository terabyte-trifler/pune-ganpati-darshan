import catalogue from '../src/content/catalogue.json' with { type: 'json' };

const R = 6371008.8, rad = d => d * Math.PI / 180;
const hav = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const core = catalogue.ganpatis
  .filter(g => g.area_is_core)
  .map(g => ({ slug: g.slug, name: g.name, lat: g.latitude, lng: g.longitude }));

const pairs = [];
for (let i = 0; i < core.length; i++)
  for (let j = i + 1; j < core.length; j++) pairs.push([core[i], core[j]]);

// Sample across the peth core rather than testing all 120 pairs.
const sample = pairs.filter((_, i) => i % 5 === 0).slice(0, 22);
const ratios = [];

for (const [a, b] of sample) {
  const url = `https://router.project-osrm.org/route/v1/foot/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    const road = j.routes?.[0]?.distance;
    if (!road) continue;
    const straight = hav(a, b);
    if (straight < 60) continue;              // too close to be meaningful
    ratios.push(road / straight);
    console.log(`  ${straight.toFixed(0).padStart(5)}m straight → ${road.toFixed(0).padStart(5)}m road  ×${(road/straight).toFixed(2)}  ${a.slug.slice(0,18)} → ${b.slug.slice(0,18)}`);
  } catch {}
  await new Promise(r => setTimeout(r, 220));   // be polite to the demo server
}

ratios.sort((x, y) => x - y);
const median = ratios[Math.floor(ratios.length / 2)];
const mean = ratios.reduce((s, v) => s + v, 0) / ratios.length;
console.log(`\n  n=${ratios.length}  median ×${median.toFixed(2)}  mean ×${mean.toFixed(2)}  min ×${ratios[0].toFixed(2)}  max ×${ratios.at(-1).toFixed(2)}`);
console.log(`  current DETOUR_FACTOR = 1.3`);
