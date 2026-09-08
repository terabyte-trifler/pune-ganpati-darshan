import { describe, it, expect } from 'vitest';
import { searchGanpatis } from '../search';
import { localGanpatis } from '@/services/catalogue';

const top = (q: string) => searchGanpatis(localGanpatis, q)[0]?.ganpati.slug;

describe('search', () => {
  it('finds Dagdusheth from a partial name', () => {
    expect(top('Dagdu')).toBe('dagdusheth-halwai-ganpati');
  });

  it('finds Kasba Ganpati', () => {
    expect(top('Kasba')).toBe('kasba-ganpati');
  });

  it('matches Marathi input', () => {
    expect(top('कसबा')).toBe('kasba-ganpati');
    expect(top('दगडूशेठ')).toBe('dagdusheth-halwai-ganpati');
  });

  it('matches a mid-name word', () => {
    expect(top('halwai')).toBe('dagdusheth-halwai-ganpati');
  });

  it('tolerates dropped letters', () => {
    expect(top('dagdusht')).toBe('dagdusheth-halwai-ganpati');
  });

  it('searches by area', () => {
    const results = searchGanpatis(localGanpatis, 'Budhwar');
    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(results.every((r) => r.ganpati.area.slug === 'budhwar-peth')).toBe(true);
  });

  it('searches by category term', () => {
    const results = searchGanpatis(localGanpatis, 'manache');
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.slice(0, 5).every((r) => r.ganpati.category === 'maanache')).toBe(true);
  });

  it('returns nothing for gibberish rather than random mandals', () => {
    expect(searchGanpatis(localGanpatis, 'zzzqqq')).toHaveLength(0);
  });

  it('returns nothing for an empty query', () => {
    expect(searchGanpatis(localGanpatis, '   ')).toHaveLength(0);
  });
});
