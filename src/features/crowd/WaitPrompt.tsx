'use client';

import { useSyncExternalStore, useState } from 'react';
import { Hourglass, X } from 'lucide-react';
import {
  getWaitPrompts, subscribeWaitPrompts, clearWaitPrompt,
} from './wait-prompt-store';
import { WaitReportButtons } from './WaitReportButtons';
import type { Ganpati } from '@/types/ganpati';
import { features } from '@/lib/env';

/**
 * "You were at Dagdusheth earlier — how long did you wait?"
 *
 * Asked on the home page, because that is where someone lands when they
 * open the app again after a darshan, and the question only works while
 * the answer is still a memory rather than a guess.
 *
 * It appears at most once per mandal, and only after the dwell tracker
 * saw a long visit end — so it never asks somebody who walked past, and
 * never asks twice. Dismissing is one tap and is remembered.
 *
 * The card renders nothing at all when there is nothing to ask, which is
 * almost always. A prompt that shows up empty, or repeats, is the fastest
 * way to make people stop reading the home page.
 */

const empty: ReturnType<typeof getWaitPrompts> = [];

function WaitPromptInner({ ganpatis }: { ganpatis: Ganpati[] }) {
  const prompts = useSyncExternalStore(
    subscribeWaitPrompts,
    getWaitPrompts,
    () => empty
  );
  const [dismissed, setDismissed] = useState<string[]>([]);

  const pending = prompts.find(
    (p) => !dismissed.includes(p.mandalId) && ganpatis.some((g) => g.id === p.mandalId)
  );
  if (!pending) return null;

  const mandal = ganpatis.find((g) => g.id === pending.mandalId)!;
  const name = mandal.name.replace(/^(Shri|Shrimant)\s+/i, '');

  const close = () => {
    setDismissed((d) => [...d, pending.mandalId]);
    clearWaitPrompt(pending.mandalId);
  };

  return (
    <section
      className="relative rounded-[var(--radius-card)] border border-[var(--shendur)]/35 bg-[var(--dhoop)] p-4"
      aria-labelledby="wait-prompt-heading"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Not now"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-[var(--faint)]"
      >
        <X size={14} aria-hidden="true" />
      </button>

      <h2
        id="wait-prompt-heading"
        className="flex items-center gap-2 pr-8 text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--shendur)]"
      >
        <Hourglass size={13} aria-hidden="true" />
        You were at {name}
      </h2>
      <p className="prose-measure mt-2 text-[15px] leading-[1.6] text-[var(--chandan)]">
        How long did you wait? It is the most useful thing you can tell
        everyone else — nobody can see a queue from across the city.
      </p>

      {/* No `location`, and so no distance gate — the only caller that
          leaves it off. Everywhere else the gate stands in for "was this
          person actually here?"; here that is already answered, and
          better: this card exists only because the dwell tracker watched
          this device sit at this mandal long enough to have been in the
          queue. Asking for a fresh fix now would refuse everybody who
          did the honest thing and answered once they got home, which is
          the whole point of asking afterwards. */}
      <div className="mt-3">
        <WaitReportButtons
          mandalId={pending.mandalId}
          compact
          onDone={() => clearWaitPrompt(pending.mandalId)}
        />
      </div>
    </section>
  );
}

/**
 * Off while `features.crowd` is false.
 *
 * A wrapper rather than an early return inside WaitPromptInner: that
 * component calls hooks, and returning before them changes hook order,
 * which React forbids. Not mounting it at all is both legal and the
 * thing actually wanted — no request is made and no state is kept.
 */
export function WaitPrompt(props: Parameters<typeof WaitPromptInner>[0]) {
  if (!features.crowd) return null;
  return <WaitPromptInner {...props} />;
}
