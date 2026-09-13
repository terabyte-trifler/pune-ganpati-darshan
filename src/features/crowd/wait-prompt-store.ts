'use client';

/**
 * Mandals this device appears to have queued at, waiting to be asked.
 *
 * The reason Phase 3 can work at all. Nobody opens an app to volunteer
 * how long they waited — but the dwell tracker already knows the device
 * spent a long time inside one mandal's zone, so the app can ask the
 * question at the only moment it is easy to answer: afterwards, about
 * something that just happened.
 *
 * ---------------------------------------------------------------------
 * On the device, and only the device.
 *
 * This never leaves localStorage. It is a list of places this phone
 * thinks it stood, which is precisely the location history the rest of
 * this feature refuses to put on a server — so it stays where the person
 * can clear it, and only a mandal id and a duration are ever sent, and
 * only if they tap an answer.
 *
 * Entries expire: an unanswered prompt about last night's queue is noise,
 * and a stale one would invite a guess rather than a memory.
 */

const KEY = 'pg:wait-prompts:v1';
/** After this, the visit is too old to remember accurately. */
const EXPIRY_MS = 6 * 60 * 60 * 1000;

export interface WaitPrompt {
  mandalId: string;
  /** When the visit ended, in ms. */
  at: number;
  /** How long the device was inside the zone, in seconds. */
  dwellSeconds: number;
}

/**
 * The snapshot handed to React, held by reference.
 *
 * useSyncExternalStore compares snapshots with Object.is and re-renders
 * when they differ — so returning a freshly parsed array on every call is
 * an infinite render loop, not merely wasteful. The first version did
 * exactly that and locked the home page up; the component test caught it
 * as "Maximum update depth exceeded".
 *
 * So the parsed list is cached here and only replaced when it actually
 * changes: on a write, or when an entry has expired.
 */
let snapshot: WaitPrompt[] = [];
let loaded = false;

function same(a: WaitPrompt[], b: WaitPrompt[]): boolean {
  return a.length === b.length && a.every((p, i) => p.mandalId === b[i].mandalId && p.at === b[i].at);
}

function read(): WaitPrompt[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter(
      (p): p is WaitPrompt =>
        typeof p === 'object' && p !== null &&
        typeof (p as WaitPrompt).mandalId === 'string' &&
        typeof (p as WaitPrompt).at === 'number' &&
        now - (p as WaitPrompt).at < EXPIRY_MS
    );
  } catch {
    // A corrupt or blocked store must never break the page: the prompt is
    // a nicety, the crowd panel behind it is not.
    return [];
  }
}

function write(list: WaitPrompt[]) {
  const next = list.slice(-5);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Private mode, or storage full. Losing a prompt costs nothing. */
  }
  // The stored value and the snapshot React sees must move together, or
  // the card keeps offering a prompt that has already been answered.
  snapshot = next;
  loaded = true;
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();

export function subscribeWaitPrompts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWaitPrompts(): WaitPrompt[] {
  if (!loaded) {
    loaded = true;
    snapshot = read();
    return snapshot;
  }
  // Only re-parse enough to notice an expiry: anything else would hand
  // React a new array for an unchanged list.
  const now = Date.now();
  const live = snapshot.filter((p) => now - p.at < EXPIRY_MS);
  if (!same(live, snapshot)) snapshot = live;
  return snapshot;
}

/**
 * Note that this device seems to have queued somewhere.
 *
 * Called by the dwell tracker when a long visit ends. Never called for a
 * walk-past: a prompt about a mandal somebody strolled past is a question
 * they cannot answer, and asking it twice teaches them to ignore the card.
 */
export function noteQueued(mandalId: string, dwellSeconds: number) {
  const list = getWaitPrompts().filter((p) => p.mandalId !== mandalId);
  list.push({ mandalId, at: Date.now(), dwellSeconds });
  write(list);
}

/** Answered, or dismissed. Either way, stop asking. */
export function clearWaitPrompt(mandalId: string) {
  write(getWaitPrompts().filter((p) => p.mandalId !== mandalId));
}

/** Tests only: forget the cached snapshot between cases. */
export function resetWaitPromptsForTesting() {
  snapshot = [];
  loaded = false;
}
