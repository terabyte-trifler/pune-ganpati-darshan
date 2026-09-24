import { describe, it, expect } from 'vitest';
import { suggestPages, PAGE_SUGGESTIONS } from '../page-suggestions';
import { localGanpatis } from '@/services/catalogue';

/**
 * These guard the reason the file exists: the queries that really were
 * typed on 22 September and really did return nothing.
 */
describe('page suggestions', () => {
  it.each([
    ['visarjan', '/visarjan'],
    ['miravnuk', '/visarjan'],
    ['विसर्जन', '/visarjan'],
    ['parking', '/parking'],
    ['map', '/map'],
  ])('answers %s with %s', (query, href) => {
    expect(suggestPages(query).map((p) => p.href)).toContain(href);
  });

  it('stays out of the way of a search that is going fine', () => {
    // Every mandal name must come back clean: a page card pushed above a
    // list that already found the right mandal is noise.
    for (const g of localGanpatis) {
      expect(suggestPages(g.name), g.name).toHaveLength(0);
    }
  });

  it('suggests nothing for an unrelated word', () => {
    for (const q of ['chocolate', 'laptop', 'xyzzy']) {
      expect(suggestPages(q)).toHaveLength(0);
    }
  });

  it('ignores fragments too short to mean anything', () => {
    expect(suggestPages('pa')).toHaveLength(0);
    expect(suggestPages('')).toHaveLength(0);
  });

  it('never floods the results', () => {
    for (const p of PAGE_SUGGESTIONS) {
      expect(suggestPages(p.terms[0]).length).toBeLessThanOrEqual(2);
    }
  });
});
