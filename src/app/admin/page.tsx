import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Upload, Pencil, Activity, Globe, Calculator } from 'lucide-react';
import { getSessionUser } from '@/services/auth';
import { getAllGanpatis } from '@/services/ganpati';
import { Button } from '@/components/ui/Button';
import { CategoryBadge, ConfidenceBadge } from '@/components/ui/Badge';

export const metadata = { title: 'Admin', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Middleware already gated this route; re-checking here is the actual
  // authorization boundary (§27).
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=/admin');
  if (!user.isAdmin) redirect('/');

  const ganpatis = await getAllGanpatis();

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-[var(--chandan)]">
            Manage mandals
          </h1>
          <p className="text-[13px] text-[var(--muted)]">
            {ganpatis.length} published · signed in as {user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/crowd"><Activity size={15} aria-hidden="true" />Crowd</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/crowd-prior"><Calculator size={15} aria-hidden="true" />Prior</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/traffic"><Globe size={15} aria-hidden="true" />Traffic</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/import"><Upload size={15} aria-hidden="true" />Import</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/ganpati/new"><Plus size={15} aria-hidden="true" />New mandal</Link>
          </Button>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]">
        {ganpatis.map((g) => (
          <li key={g.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[14px] font-semibold text-[var(--chandan)]">
                  {g.name}
                </span>
                <CategoryBadge category={g.category} rank={g.manacheRank} />
                <ConfidenceBadge confidence={g.confidence} />
              </div>
              <p className="mt-0.5 truncate text-[12px] text-[var(--faint)]">
                /{g.slug} · {g.area.name} · {g.location.lat.toFixed(4)}, {g.location.lng.toFixed(4)}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/ganpati/${g.id}`} aria-label={`Edit ${g.name}`}>
                <Pencil size={15} aria-hidden="true" />
                Edit
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
