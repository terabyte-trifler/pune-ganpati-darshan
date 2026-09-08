'use client';

import { useState, useTransition } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { importGanpatis, type ImportReport } from './actions';
import { Button } from '@/components/ui/Button';

const SAMPLE = `name,nameMr,category,areaSlug,latitude,longitude,prominence
Example Mandal,उदाहरण मंडळ,local,kasba-peth,18.5200,73.8550,300`;

export function ImportForm({ areaSlugs }: { areaSlugs: string[] }) {
  const [payload, setPayload] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => setReport(await importGanpatis(payload)));
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-[var(--muted)]">
          CSV or JSON
        </span>
        <textarea
          value={payload}
          onChange={(e) => { setPayload(e.target.value); setReport(null); }}
          rows={12}
          spellCheck={false}
          placeholder={SAMPLE}
          className="w-full rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--dhoop)] p-3 font-mono text-[13px] text-[var(--chandan)] placeholder:text-[var(--faint)] focus:border-[var(--shendur)]/60 focus:outline-none"
        />
      </label>

      <p className="text-[12px] leading-relaxed text-[var(--faint)]">
        Required columns: <code>name, category, areaSlug, latitude, longitude</code>.
        Valid areas: {areaSlugs.join(', ')}. Rows without an explicit
        <code> confidence</code> are imported as community data.
      </p>

      <Button onClick={submit} disabled={pending || payload.trim().length === 0}>
        {pending ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" />Validating…</> : 'Validate and import'}
      </Button>

      {report && (
        report.ok ? (
          <p className="flex items-center gap-2 rounded-lg border border-[var(--tulsi)]/40 bg-[var(--tulsi)]/10 px-3 py-2 text-[13px] text-[var(--chandan)]">
            <CheckCircle2 size={15} aria-hidden="true" className="text-[var(--tulsi)]" />
            Imported {report.inserted} {report.inserted === 1 ? 'mandal' : 'mandals'}.
          </p>
        ) : (
          <div role="alert" className="rounded-lg border border-[var(--kumkum)]/40 bg-[var(--kumkum)]/10 p-3">
            <p className="text-[13px] font-semibold text-[#ef8f88]">
              Nothing was imported — {report.errors.length} {report.errors.length === 1 ? 'problem' : 'problems'} found:
            </p>
            <ul className="mt-2 space-y-1">
              {report.errors.slice(0, 12).map((e, i) => (
                <li key={i} className="text-[12px] text-[var(--muted)]">
                  {e.row > 0 ? `Row ${e.row}: ` : ''}{e.message}
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
