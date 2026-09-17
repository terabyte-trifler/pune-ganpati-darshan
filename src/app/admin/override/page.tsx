import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/services/auth';
import { getAllGanpatis } from '@/services/ganpati';
import {
  getActiveOverrides, getOverrideCooldowns,
  OVERRIDE_HOLD_MS, OVERRIDE_COOLDOWN_MS,
} from '@/services/crowd/crowd-service';
import { getCrowdSnapshot } from '@/services/crowd/crowd-service';
import { OverrideControls } from '@/features/admin/OverrideControls';
import { CROWD_COLOR } from '@/features/crowd/CrowdBadge';

/**
 * Set a queue by hand.
 *
 * The one screen in the app where a person overrules the algorithms. It
 * shows what each mandal is reading right now and where that reading came
 * from, so an override is a correction to something visible rather than a
 * value typed into a void.
 *
 * Not linked from anywhere a visitor can reach, and the route is gated
 * twice — middleware, then the check below, which is the boundary that
 * actually counts (§27).
 */

export const metadata = { title: 'Override', robots: { index: false } };
export const dynamic = 'force-dynamic';

const SOURCE_WORD: Record<string, string> = {
  reported: 'reported',
  observed: 'observed',
  override: 'held by you',
};

export default async function AdminOverridePage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin/override');
  if (!user.isAdmin) redirect('/');

  // The snapshot used to be awaited after these three, which made a
  // fourth round trip out of a read that depends on none of them — and on
  // top of the two the session check already costs, that is what makes an
  // admin page feel slow. Nothing here is complex; there was just too
  // much of it in a row.
  const [ganpatis, overrides, cooldowns, snapshot] = await Promise.all([
    getAllGanpatis(),
    getActiveOverrides(),
    getOverrideCooldowns(),
    // The live reading, so the admin corrects what is actually on screen.
    getCrowdSnapshot().catch(() => null),
  ]);
  const byId = new Map((snapshot?.statuses ?? []).map((s) => [s.mandalId, s]));

  const heldCount = Object.keys(overrides).length;

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Admin
      </Link>

      <h1 className="mt-3 text-[24px] font-extrabold tracking-tight text-[var(--chandan)]">
        Override a queue
      </h1>

      <p className="prose-measure mt-2 flex gap-2 rounded-[var(--radius-field)] border border-[var(--zendu)]/30 bg-[var(--zendu)]/[0.07] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
        <ShieldAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--zendu)]" />
        <span>
          What you set here replaces every signal — reports, wait times,
          dwell and the estimate — for{' '}
          <strong className="font-semibold text-[var(--chandan)]">
            {Math.round(OVERRIDE_HOLD_MS / 60_000)} minutes
          </strong>
          , then expires on its own and the algorithms resume. Each mandal can
          be set again after{' '}
          {Math.round(OVERRIDE_COOLDOWN_MS / 60_000)} minutes. Every override
          is recorded against {user.email}.
        </span>
      </p>

      <p className="mt-3 text-[13px] text-[var(--muted)]">
        {heldCount === 0
          ? 'Nothing is being held by hand right now.'
          : `${heldCount} mandal${heldCount === 1 ? '' : 's'} held by hand.`}
      </p>

      <ul className="mt-4 divide-y divide-[var(--line)] rounded-[var(--radius-card)] border border-[var(--line)]">
        {ganpatis.map((g) => {
          const live = byId.get(g.id);
          const held = overrides[g.id] ?? null;

          return (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[var(--chandan)]">
                  {g.name}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--faint)]">
                  {live?.status ? (
                    <>
                      showing{' '}
                      <span
                        className="font-semibold"
                        style={{ color: CROWD_COLOR[live.status] }}
                      >
                        {live.label}
                      </span>{' '}
                      · {SOURCE_WORD[live.source] ?? live.source}
                    </>
                  ) : (
                    'no reading — showing an estimate'
                  )}
                </p>
              </div>

              <OverrideControls
                mandalId={g.id}
                active={
                  held
                    ? {
                        status: held.status,
                        expiresAt: held.expiresAt,
                        waitMinutes: held.waitMinutes,
                      }
                    : null
                }
                cooldownSeconds={cooldowns[g.id] ?? 0}
              />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
