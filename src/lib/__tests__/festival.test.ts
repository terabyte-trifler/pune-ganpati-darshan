import { describe, it, expect } from 'vitest';
import { getFestivalPhase } from '../festival';
import type { FestivalConfig } from '@/types/ganpati';

const config: FestivalConfig = {
  year: 2026,
  startDate: '2026-09-14',
  endDate: '2026-09-25',
  visarjanDate: '2026-09-25',
  greetingEn: 'Ganpati Bappa Morya',
  greetingMr: 'गणपती बाप्पा मोरया',
  tagline: null,
};

/** A UTC instant corresponding to the given IST wall-clock time. */
const ist = (s: string) => new Date(`${s}+05:30`);

describe('festival phase', () => {
  it('counts down before the festival', () => {
    const r = getFestivalPhase(config, ist('2026-09-08T10:00:00'));
    expect(r).toEqual({ phase: 'before', daysUntil: 6 });
  });

  it('reports day 1 on the opening day', () => {
    const r = getFestivalPhase(config, ist('2026-09-14T09:00:00'));
    expect(r).toMatchObject({ phase: 'during', day: 1, totalDays: 12 });
  });

  it('uses the IST day boundary, not UTC', () => {
    // 00:30 IST on opening day is still 19:00 UTC the previous day.
    // A UTC-based implementation would wrongly say "1 day to go".
    const r = getFestivalPhase(config, ist('2026-09-14T00:30:00'));
    expect(r).toMatchObject({ phase: 'during', day: 1 });
  });

  it('flags visarjan', () => {
    const r = getFestivalPhase(config, ist('2026-09-25T08:00:00'));
    expect(r).toMatchObject({ phase: 'during', day: 12, isVisarjan: true });
  });

  it('ends after the final day', () => {
    expect(getFestivalPhase(config, ist('2026-09-26T08:00:00'))).toEqual({ phase: 'after' });
  });

  it('is year-agnostic', () => {
    const next: FestivalConfig = {
      ...config, year: 2027, startDate: '2027-09-04',
      endDate: '2027-09-15', visarjanDate: '2027-09-15',
    };
    expect(getFestivalPhase(next, ist('2027-09-01T10:00:00')))
      .toEqual({ phase: 'before', daysUntil: 3 });
  });
});
