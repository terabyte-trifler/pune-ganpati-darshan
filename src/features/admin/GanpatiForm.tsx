'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { upsertGanpati, deleteGanpati, type ActionResult } from './actions';
import { Button } from '@/components/ui/Button';
import type { Area, Ganpati } from '@/types/ganpati';

/** Admin create/edit form. Server actions do the real validation. */
export function GanpatiForm({
  ganpati, areas,
}: {
  ganpati: Ganpati | null;
  areas: Area[];
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const fieldError = (name: string) =>
    result && !result.ok ? result.fieldErrors?.[name]?.[0] : undefined;

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await upsertGanpati(ganpati?.id ?? null, formData);
      setResult(res);
      if (res.ok) router.push('/admin');
    });
  };

  const handleDelete = () => {
    if (!ganpati) return;
    startTransition(async () => {
      const res = await deleteGanpati(ganpati.id);
      setResult(res);
      if (res.ok) router.push('/admin');
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      {result && !result.ok && (
        <p role="alert" className="rounded-lg border border-[var(--kumkum)]/40 bg-[var(--kumkum)]/10 px-3 py-2 text-[13px] text-[#ef8f88]">
          {result.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={ganpati?.name} required error={fieldError('name')} />
        <Field label="Name (Marathi)" name="nameMr" defaultValue={ganpati?.nameMr ?? ''} lang="mr" error={fieldError('nameMr')} />
        <Field label="Slug" name="slug" defaultValue={ganpati?.slug} required hint="lowercase-with-hyphens" error={fieldError('slug')} />

        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[var(--muted)]">Area</span>
          <select name="areaSlug" defaultValue={ganpati?.area.slug} required className={selectClass}>
            {areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[var(--muted)]">Category</span>
          <select name="category" defaultValue={ganpati?.category ?? 'local'} className={selectClass}>
            <option value="maanache">Manache Paach</option>
            <option value="famous">Famous</option>
            <option value="historic">Historic</option>
            <option value="local">Neighbourhood</option>
          </select>
        </label>

        <Field label="Manache rank (1-5)" name="manacheRank" type="number" min="1" max="5"
               defaultValue={ganpati?.manacheRank ?? ''} error={fieldError('manacheRank')}
               hint="Only for Manache Paach; leave blank otherwise" />

        <Field label="Latitude" name="latitude" type="number" step="0.000001" required
               defaultValue={ganpati?.location.lat} error={fieldError('latitude')} />
        <Field label="Longitude" name="longitude" type="number" step="0.000001" required
               defaultValue={ganpati?.location.lng} error={fieldError('longitude')} />

        <Field label="Prominence (0-1000)" name="prominence" type="number" min="0" max="1000"
               defaultValue={ganpati?.prominence ?? 0} hint="Editorial sort weight, not a rating" />
        <Field label="Established year" name="establishedYear" type="number"
               defaultValue={ganpati?.establishedYear ?? ''} />

        <Field label="Opening time" name="timingOpen" type="time" defaultValue={ganpati?.timings.open ?? ''}
               hint="Leave blank until the mandal announces it" />
        <Field label="Closing time" name="timingClose" type="time" defaultValue={ganpati?.timings.close ?? ''}
               error={fieldError('timingClose')} />

        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[var(--muted)]">Data confidence</span>
          <select name="confidence" defaultValue={ganpati?.confidence ?? 'community'} className={selectClass}>
            <option value="verified">Verified</option>
            <option value="community">Community</option>
            <option value="demo">Demo / placeholder</option>
          </select>
        </label>

        <Field label="Tags (comma separated)" name="tags" defaultValue={ganpati?.tags.join(', ') ?? ''} />
      </div>

      <Field label="Address" name="address" defaultValue={ganpati?.location.address ?? ''} />

      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-[var(--muted)]">Description</span>
        <textarea name="description" rows={3} defaultValue={ganpati?.description ?? ''} className={inputClass} />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-[var(--muted)]">Visitor tip</span>
        <textarea name="visitorTip" rows={2} defaultValue={ganpati?.visitorTip ?? ''} className={inputClass} />
      </label>

      <div className="flex flex-wrap gap-4">
        <Toggle name="featured" label="Featured" defaultChecked={ganpati?.featured} />
        <Toggle name="verified" label="Verified" defaultChecked={ganpati?.verified} />
        <Toggle name="published" label="Published" defaultChecked={ganpati?.published ?? true} />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" />Saving…</> : 'Save mandal'}
        </Button>

        {ganpati && (
          confirmingDelete ? (
            <>
              <Button type="button" variant="danger" onClick={handleDelete} disabled={pending}>
                Confirm delete
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={15} aria-hidden="true" />Delete
            </Button>
          )
        )}
      </div>
    </form>
  );
}

const inputClass =
  'w-full rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--dhoop)] px-3 py-2.5 text-[15px] text-[var(--chandan)] focus:border-[var(--shendur)]/60 focus:outline-none';
const selectClass = inputClass;

function Field({
  label, name, hint, error, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string; name: string; hint?: string; error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[var(--muted)]">{label}</span>
      <input name={name} className={inputClass} aria-invalid={Boolean(error)} {...props} />
      {hint && !error && <span className="mt-1 block text-[12px] text-[var(--faint)]">{hint}</span>}
      {error && <span className="mt-1 block text-[12px] text-[#ef8f88]">{error}</span>}
    </label>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-[14px] text-[var(--chandan)]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--shendur)]" />
      {label}
    </label>
  );
}
