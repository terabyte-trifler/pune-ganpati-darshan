import { describe, it, expect } from 'vitest';
import { getFestivalPhase, isVisarjanImminent } from '../festival';
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

  // The procession reaches the ghats in the small hours. Ending the festival
  // at midnight would blank the site during its busiest hours of the year.
  it('keeps the night after visarjan on visarjan day', () => {
    expect(getFestivalPhase(config, ist('2026-09-26T00:30:00'))).toMatchObject({
      phase: 'during', day: 12, isVisarjan: true, isVisarjanNight: true,
    });
    expect(getFestivalPhase(config, ist('2026-09-26T05:59:00'))).toMatchObject({
      phase: 'during', isVisarjanNight: true,
    });
  });

  it('is not visarjan night before the idols leave', () => {
    expect(getFestivalPhase(config, ist('2026-09-25T00:30:00'))).toMatchObject({
      phase: 'during', day: 12, isVisarjan: true, isVisarjanNight: false,
    });
  });

  it('ends once the visarjan night is over', () => {
    expect(getFestivalPhase(config, ist('2026-09-26T06:00:00'))).toEqual({ phase: 'after' });
  });

  it('only extends the night that follows visarjan', () => {
    const midFestival: FestivalConfig = { ...config, visarjanDate: '2026-09-20' };
    expect(getFestivalPhase(midFestival, ist('2026-09-21T00:30:00'))).toMatchObject({
      phase: 'during', day: 7, isVisarjan: true, isVisarjanNight: true,
    });
  });

  it('flags visarjan as imminent on the eve and the day', () => {
    expect(isVisarjanImminent(config, ist('2026-09-24T21:00:00'))).toBe(true);
    expect(isVisarjanImminent(config, ist('2026-09-25T11:00:00'))).toBe(true);
    // Still running, in the small hours.
    expect(isVisarjanImminent(config, ist('2026-09-26T02:00:00'))).toBe(true);
  });

  it('does not flag visarjan on ordinary days or once it is over', () => {
    expect(isVisarjanImminent(config, ist('2026-09-20T21:00:00'))).toBe(false);
    expect(isVisarjanImminent(config, ist('2026-09-26T09:00:00'))).toBe(false);
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
