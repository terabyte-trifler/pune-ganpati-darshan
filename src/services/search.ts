import type { Ganpati } from '@/types/ganpati';

/**
 * Client-side fuzzy search over the loaded catalogue.
 *
 * The catalogue is small and already in memory, so searching locally is
 * instant, free and works offline — and it means we never call Google
 * Places for a query the local data can answer (§18, §58).
 *
 * Matching is transliteration-tolerant in the ways Pune users actually
 * type: "dagdu" for Dagdusheth, "kasba" for कसबा, "budhwar" for the peth.
 */

export interface SearchHit {
  ganpati: Ganpati;
  score: number;
  /** Which field matched, so the UI can explain the result. */
  matchedOn: 'name' | 'name_mr' | 'area' | 'tag' | 'category';
}

const CATEGORY_TERMS: Record<string, string[]> = {
  maanache: ['manache', 'maanache', 'मानाचे', 'paach', 'panch', 'five'],
  famous: ['famous', 'popular', 'प्रसिद्ध'],
  historic: ['historic', 'heritage', 'old', 'ऐतिहासिक'],
  local: ['local', 'neighbourhood', 'neighborhood', 'स्थानिक'],
};

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    // Strip Latin diacritics but leave Devanagari intact.
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Character-subsequence match with a contiguity bonus. Cheap, and it
 * handles the dropped letters people type on a phone ("dagdusht").
 */
function subsequenceScore(haystack: string, needle: string): number {
  let hi = 0;
  let matched = 0;
  let streak = 0;
  let bestStreak = 0;

  for (const char of needle) {
    const found = haystack.indexOf(char, hi);
    if (found === -1) {
      streak = 0;
      continue;
    }
    matched += 1;
    streak = found === hi ? streak + 1 : 1;
    bestStreak = Math.max(bestStreak, streak);
    hi = found + 1;
  }

  if (matched < needle.length) return 0;
  return 0.35 + 0.25 * (bestStreak / needle.length);
}

function fieldScore(field: string | null, query: string): number {
  if (!field) return 0;
  const value = normalise(field);
  if (value === query) return 1;
  if (value.startsWith(query)) return 0.92;

  // Word-start match: "halwai" should hit "Dagdusheth Halwai Ganpati".
  if (value.split(/[\s,—-]+/).some((w) => w.startsWith(query))) return 0.8;
  if (value.includes(query)) return 0.66;

  return query.length >= 4 ? subsequenceScore(value, query) : 0;
}

export function searchGanpatis(
  ganpatis: Ganpati[],
  rawQuery: string,
  limit = 20
): SearchHit[] {
  const query = normalise(rawQuery);
  if (query.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const g of ganpatis) {
    let best = 0;
    let matchedOn: SearchHit['matchedOn'] = 'name';

    const nameScore = fieldScore(g.name, query);
    if (nameScore > best) { best = nameScore; matchedOn = 'name'; }

    // Marathi matches score slightly higher than an equivalent English
    // partial: typing Devanagari is deliberate, so it is a stronger signal.
    const mrScore = fieldScore(g.nameMr, query) * 1.02;
    if (mrScore > best) { best = mrScore; matchedOn = 'name_mr'; }

    const areaScore = fieldScore(g.area.name, query) * 0.85;
    if (areaScore > best) { best = areaScore; matchedOn = 'area'; }

    const areaMrScore = fieldScore(g.area.nameMr, query) * 0.85;
    if (areaMrScore > best) { best = areaMrScore; matchedOn = 'area'; }

    for (const tag of g.tags) {
      const tagScore = fieldScore(tag.replace(/-/g, ' '), query) * 0.7;
      if (tagScore > best) { best = tagScore; matchedOn = 'tag'; }
    }

    if (CATEGORY_TERMS[g.category]?.some((t) => normalise(t).startsWith(query))) {
      const catScore = 0.75;
      if (catScore > best) { best = catScore; matchedOn = 'category'; }
    }

    if (best > 0) {
      // Prominence breaks ties so the mandal a visitor probably meant wins.
      hits.push({ ganpati: g, score: best + g.prominence / 100_000, matchedOn });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
