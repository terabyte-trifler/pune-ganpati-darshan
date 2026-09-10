import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The privacy page has to stay true.
 *
 * "Your data" names six storage keys and offers to clear them. A key added
 * anywhere else in the app would make that list quietly incomplete — the
 * page would still read well, and it would be a false claim on the one
 * page whose whole job is being checkable.
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
  });
}

/** Keys the page lists and the controls clear. */
const DECLARED = new Set([
  'pg.plan',
  'pg.favorites',
  'pg.session',
  'pg.referrer',
  'ganpatigo_crowd_snapshot',
  'ganpatigo_device_id',
]);

describe('stored data', () => {
  it('declares every key the app actually writes to the device', () => {
    const src = join(process.cwd(), 'src');
    const used = new Set<string>();

    for (const file of walk(src)) {
      // The page and its controls are the declaration, not a usage.
      if (file.includes('StoredData') || file.includes(join('app', 'about'))) continue;
      if (file.includes('__tests__')) continue;
      const text = readFileSync(file, 'utf8');

      for (const m of text.matchAll(
        /(?:localStorage|sessionStorage)\.(?:get|set|remove)Item\(\s*(['"`])([^'"`]+)\1/g
      )) {
        used.add(m[2]);
      }
      // Most are held in a constant and referenced by name.
      for (const m of text.matchAll(/(?:_KEY|\bKEY)\s*=\s*['"]([^'"]+)['"]/g)) {
        used.add(m[1]);
      }
    }

    const undeclared = [...used].filter((k) => !DECLARED.has(k));
    expect(
      undeclared,
      `written to the device but not listed on /about: ${undeclared.join(', ')}`
    ).toEqual([]);

    // And the other direction: the page must not offer to clear something
    // that no longer exists, which would be a control that does nothing.
    const unused = [...DECLARED].filter((k) => !used.has(k));
    expect(unused, `listed on /about but never written: ${unused.join(', ')}`).toEqual([]);
  });
});
