import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/services/auth';
import { getAllGanpatis, getAreas } from '@/services/ganpati';
import { GanpatiForm } from '@/features/admin/GanpatiForm';

export const metadata = { title: 'Edit mandal', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminGanpatiPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user?.isAdmin) redirect('/');

  const { id } = await params;
  const isNew = id === 'new';

  const [areas, all] = await Promise.all([getAreas(), getAllGanpatis()]);
  const ganpati = isNew ? null : all.find((g) => g.id === id) ?? null;
  if (!isNew && !ganpati) notFound();

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-[13px] text-[var(--shendur)]">← All mandals</Link>
      <h1 className="mb-6 mt-2 text-[24px] font-extrabold tracking-tight text-[var(--chandan)]">
        {isNew ? 'New mandal' : ganpati!.name}
      </h1>
      <GanpatiForm ganpati={ganpati} areas={areas} />
    </main>
  );
}
