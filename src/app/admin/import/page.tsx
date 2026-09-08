import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/services/auth';
import { getAreas } from '@/services/ganpati';
import { ImportForm } from '@/features/admin/ImportForm';

export const metadata = { title: 'Import mandals', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminImportPage() {
  const user = await getSessionUser();
  if (!user?.isAdmin) redirect('/');

  const areas = await getAreas();

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-[13px] text-[var(--shendur)]">← All mandals</Link>
      <h1 className="mb-2 mt-2 text-[24px] font-extrabold tracking-tight text-[var(--chandan)]">
        Import mandals
      </h1>
      <p className="mb-6 text-[13px] leading-relaxed text-[var(--muted)]">
        Paste CSV or JSON. Every row is validated before anything is written —
        if one row fails, nothing is imported.
      </p>
      <ImportForm areaSlugs={areas.map((a) => a.slug)} />
    </main>
  );
}
