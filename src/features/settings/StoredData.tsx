'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Everything this app keeps on your device, and a way to remove it.
 *
 * There is nothing to delete on a server: the app has no accounts, and a
 * queue report carries an anonymous device id rather than anything about a
 * person. So this is genuinely the whole of it — which is only worth
 * claiming if the controls actually clear what they name.
 *
 * The keys are printed rather than summarised. "Clears your data" is what
 * every app says; naming them means a reader can check the claim in their
 * own devtools.
 */

/** Kept in step with the modules that own these keys. */
const PLAN_KEYS = ['pg.plan', 'pg.favorites', 'pg.mode'] as const;
const VISIT_KEYS = ['pg.session', 'pg.referrer'] as const;
const CACHE_KEYS = ['ganpatigo_crowd_snapshot'] as const;
const DEVICE_KEYS = ['ganpatigo_device_id'] as const;

type Scope = 'plan' | 'visit' | 'all';

function clearKeys(local: readonly string[], session: readonly string[]) {
  for (const k of local) {
    try { window.localStorage.removeItem(k); } catch { /* storage disabled */ }
  }
  for (const k of session) {
    try { window.sessionStorage.removeItem(k); } catch { /* storage disabled */ }
  }
}

const ACTIONS: {
  scope: Scope;
  title: string;
  detail: string;
  keys: string;
  label: string;
}[] = [
  {
    scope: 'plan',
    title: 'Clear your darshan and saved mandals',
    detail:
      'The stops in your plan, how you said you are getting around, and every mandal you have saved. Nothing else changes.',
    keys: 'pg.plan · pg.favorites · pg.mode',
    label: 'Clear',
  },
  {
    scope: 'visit',
    title: 'Clear this visit',
    detail:
      'The anonymous session id used to count visits, the site you arrived from, and the cached crowd readings. Your plan and saved mandals are kept.',
    keys: 'pg.session · pg.referrer · ganpatigo_crowd_snapshot',
    label: 'Clear',
  },
  {
    scope: 'all',
    title: 'Reset everything',
    detail:
      'All of the above, plus the anonymous id your queue reports are made with. A new one is generated the next time you report, so nothing on this device stays connected to what you reported before.',
    keys: 'all of the above · ganpatigo_device_id',
    label: 'Reset',
  },
];

export function StoredData() {
  const [done, setDone] = useState<Scope | null>(null);

  const run = (scope: Scope) => {
    if (scope === 'plan') clearKeys(PLAN_KEYS, []);
    if (scope === 'visit') clearKeys(CACHE_KEYS, VISIT_KEYS);
    if (scope === 'all') {
      clearKeys([...PLAN_KEYS, ...CACHE_KEYS, ...DEVICE_KEYS], VISIT_KEYS);
    }
    setDone(scope);
    // Other surfaces read from module stores seeded at load, so a reload is
    // the honest way to show the data is gone rather than leaving a stale
    // copy of it on screen.
    window.setTimeout(() => window.location.reload(), 900);
  };

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {ACTIONS.map((a) => (
        <li
          key={a.scope}
          className="rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[var(--chandan)]">{a.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                {a.detail}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[var(--faint)]">{a.keys}</p>
            </div>
            <Button
              size="sm"
              variant={a.scope === 'all' ? 'secondary' : 'ghost'}
              onClick={() => run(a.scope)}
              disabled={done !== null}
              className="shrink-0"
            >
              {done === a.scope ? (
                <>
                  <Check size={14} aria-hidden="true" />
                  Cleared
                </>
              ) : (
                a.label
              )}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
