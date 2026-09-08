import { describe, it, expect } from 'vitest';
import catalogue from '@/content/catalogue.json';

/**
 * Guards against the query and the row mapper drifting apart.
 *
 * `darshan_minutes` was added to the schema and to the generated snapshot but
 * not to the Supabase select, so the live app read null dwell times and the
 * planner silently budgeted five minutes per mandal. Nothing failed — the
 * numbers were just wrong. These tests compare the columns the service asks
 * for against the fields the snapshot actually carries.
 */

import { GANPATI_COLUMNS, DERIVED_CATALOGUE_FIELDS } from '@/db/ganpati-columns';

describe('ganpati select', () => {
  it('requests every field the catalogue snapshot exposes', () => {
    const selected = new Set<string>(GANPATI_COLUMNS);
    const sample = (catalogue as { ganpatis: Record<string, unknown>[] }).ganpatis[0];

    const derived = new Set<string>(DERIVED_CATALOGUE_FIELDS);

    const missing = Object.keys(sample).filter(
      (key) => !selected.has(key) && !derived.has(key)
    );

    expect(missing, `select is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('includes the fields the planner depends on', () => {
    const selected: readonly string[] = GANPATI_COLUMNS;
    // Losing any of these makes route timings wrong rather than broken.
    for (const required of ['darshan_minutes', 'peak_darshan_minutes', 'darshan_style']) {
      expect(selected, `${required} must be selected`).toContain(required);
    }
  });
});
