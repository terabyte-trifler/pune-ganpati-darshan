import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWaitPrompts, noteQueued, clearWaitPrompt, resetWaitPromptsForTesting,
} from '@/features/crowd/wait-prompt-store';

/**
 * The prompt store.
 *
 * The bug this pins was not a logic error: getWaitPrompts parsed
 * localStorage on every call and handed React a brand new array each
 * time. useSyncExternalStore compares snapshots with Object.is, so the
 * home page re-rendered forever — "Maximum update depth exceeded" — and
 * nothing on it worked. Referential stability IS the contract here.
 */

beforeEach(() => {
  localStorage.clear();
  resetWaitPromptsForTesting();
});

describe('the snapshot React reads', () => {
  it('is the same array when nothing has changed', () => {
    noteQueued('m1', 900);
    expect(getWaitPrompts()).toBe(getWaitPrompts());
  });

  it('is a different array once something changes', () => {
    noteQueued('m1', 900);
    const before = getWaitPrompts();
    noteQueued('m2', 1200);
    expect(getWaitPrompts()).not.toBe(before);
    expect(getWaitPrompts()).toHaveLength(2);
  });

  it('survives a store that throws', () => {
    // Private mode, or storage disabled. The prompt is a nicety; the page
    // behind it is not.
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('denied'); };
    expect(() => noteQueued('m1', 900)).not.toThrow();
    Storage.prototype.setItem = original;
  });
});

describe('what gets remembered', () => {
  it('keeps one entry per mandal, not one per visit', () => {
    noteQueued('m1', 600);
    noteQueued('m1', 2400);
    const list = getWaitPrompts();
    expect(list).toHaveLength(1);
    expect(list[0].dwellSeconds).toBe(2400);
  });

  it('forgets a mandal once it is answered or dismissed', () => {
    noteQueued('m1', 900);
    clearWaitPrompt('m1');
    expect(getWaitPrompts()).toHaveLength(0);
  });

  it('drops a visit too old to remember accurately', () => {
    const sevenHoursAgo = Date.now() - 7 * 60 * 60 * 1000;
    localStorage.setItem(
      'pg:wait-prompts:v1',
      JSON.stringify([{ mandalId: 'm1', at: sevenHoursAgo, dwellSeconds: 900 }])
    );
    resetWaitPromptsForTesting();
    // Asking about last night invites a guess rather than a memory.
    expect(getWaitPrompts()).toHaveLength(0);
  });
});
