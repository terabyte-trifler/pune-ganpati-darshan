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
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-5)));
  } catch {
    /* Private mode, or storage full. Losing a prompt costs nothing. */
  }
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();

export function subscribeWaitPrompts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWaitPrompts(): WaitPrompt[] {
  return read();
}

/**
 * Note that this device seems to have queued somewhere.
 *
 * Called by the dwell tracker when a long visit ends. Never called for a
 * walk-past: a prompt about a mandal somebody strolled past is a question
 * they cannot answer, and asking it twice teaches them to ignore the card.
 */
export function noteQueued(mandalId: string, dwellSeconds: number) {
  const list = read().filter((p) => p.mandalId !== mandalId);
  list.push({ mandalId, at: Date.now(), dwellSeconds });
  write(list);
}

/** Answered, or dismissed. Either way, stop asking. */
export function clearWaitPrompt(mandalId: string) {
  write(read().filter((p) => p.mandalId !== mandalId));
}
