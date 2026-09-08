'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/services/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { ganpatiInputSchema, importRowSchema, slugify } from './schemas';

/**
 * Admin mutations.
 *
 * Every action re-checks `requireAdmin()` on the server. A Server Action is
 * a public HTTP endpoint — hiding the form is not authorization (§27).
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type Denied = Extract<ActionResult, { ok: false }>;

async function authorize(): Promise<Denied | null> {
  try {
    await requireAdmin();
    return null;
  } catch {
    return { ok: false, error: 'You do not have permission to do that.' };
  }
}

function toRow(input: ReturnType<typeof ganpatiInputSchema.parse>, areaId: string) {
  return {
    slug: input.slug,
    name: input.name,
    name_mr: input.nameMr || null,
    description: input.description || null,
    visitor_tip: input.visitorTip || null,
    category: input.category,
    area_id: areaId,
    address: input.address || null,
    latitude: input.latitude,
    longitude: input.longitude,
    google_place_id: input.googlePlaceId || null,
    manache_rank: input.manacheRank ?? null,
    prominence: input.prominence,
    established_year: input.establishedYear ?? null,
    timing_open: input.timingOpen || null,
    timing_close: input.timingClose || null,
    timing_note: input.timingNote || null,
    tags: input.tags,
    confidence: input.confidence,
    featured: input.featured,
    verified: input.verified,
    published: input.published,
  };
}

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return ganpatiInputSchema.safeParse({
    ...raw,
    tags: String(raw.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    featured: raw.featured === 'on',
    verified: raw.verified === 'on',
    published: raw.published !== 'off',
    manacheRank: raw.manacheRank ? Number(raw.manacheRank) : null,
    establishedYear: raw.establishedYear ? Number(raw.establishedYear) : null,
    nameMr: raw.nameMr || null,
    description: raw.description || null,
    visitorTip: raw.visitorTip || null,
    address: raw.address || null,
    googlePlaceId: raw.googlePlaceId || null,
    timingOpen: raw.timingOpen || null,
    timingClose: raw.timingClose || null,
    timingNote: raw.timingNote || null,
  });
}

async function resolveAreaId(areaSlug: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.from('areas').select('id').eq('slug', areaSlug).maybeSingle();
  return data?.id ?? null;
}

export async function upsertGanpati(
  id: string | null,
  formData: FormData
): Promise<ActionResult> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const areaId = await resolveAreaId(parsed.data.areaSlug);
  if (!areaId) return { ok: false, error: `Unknown area "${parsed.data.areaSlug}".` };

  const supabase = getSupabaseAdminClient();
  const row = toRow(parsed.data, areaId);

  const { error } = id
    ? await supabase.from('ganpatis').update(row).eq('id', id)
    : await supabase.from('ganpatis').insert(row);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/');
  revalidatePath('/explore');
  revalidatePath('/admin');
  revalidatePath(`/ganpati/${parsed.data.slug}`);

  return { ok: true, message: id ? 'Mandal updated.' : 'Mandal created.' };
}

export async function deleteGanpati(id: string): Promise<ActionResult> {
  const denied = await authorize();
  if (denied) return denied;

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('ganpatis').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/');
  revalidatePath('/explore');
  revalidatePath('/admin');
  return { ok: true, message: 'Mandal deleted.' };
}

export interface ImportReport {
  ok: boolean;
  inserted: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * Validates an entire import before writing anything: a partial import
 * leaves the catalogue in a state nobody asked for (§42).
 */
export async function importGanpatis(payload: string): Promise<ImportReport> {
  const denied = await authorize();
  if (denied) return { ok: false, inserted: 0, errors: [{ row: 0, message: denied.error }] };

  let records: unknown[];
  try {
    const trimmed = payload.trim();
    records = trimmed.startsWith('[') ? JSON.parse(trimmed) : parseCsv(trimmed);
  } catch (error) {
    return { ok: false, inserted: 0, errors: [{ row: 0, message: `Could not parse input: ${(error as Error).message}` }] };
  }

  if (records.length === 0) {
    return { ok: false, inserted: 0, errors: [{ row: 0, message: 'No rows found.' }] };
  }

  const errors: ImportReport['errors'] = [];
  const valid: Array<ReturnType<typeof importRowSchema.parse>> = [];

  records.forEach((record, index) => {
    const parsed = importRowSchema.safeParse(record);
    if (parsed.success) valid.push(parsed.data);
    else {
      errors.push({
        row: index + 1,
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }
  });

  if (errors.length > 0) {
    return { ok: false, inserted: 0, errors };
  }

  const supabase = getSupabaseAdminClient();
  const { data: areas } = await supabase.from('areas').select('id, slug');
  const areaBySlug = new Map((areas ?? []).map((a) => [a.slug, a.id]));

  const rows = [];
  for (const [index, record] of valid.entries()) {
    const areaId = areaBySlug.get(record.areaSlug);
    if (!areaId) {
      errors.push({ row: index + 1, message: `Unknown area "${record.areaSlug}"` });
      continue;
    }
    rows.push({
      slug: record.slug ?? slugify(record.name),
      name: record.name,
      name_mr: record.nameMr ?? null,
      description: record.description ?? null,
      category: record.category,
      area_id: areaId,
      address: record.address ?? null,
      latitude: record.latitude,
      longitude: record.longitude,
      manache_rank: record.manacheRank ?? null,
      prominence: record.prominence ?? 0,
      established_year: record.establishedYear ?? null,
      // Imported data is community-grade unless explicitly stated.
      confidence: record.confidence ?? 'community',
      published: true,
    });
  }

  if (errors.length > 0) return { ok: false, inserted: 0, errors };

  const { error } = await supabase
    .from('ganpatis')
    .upsert(rows, { onConflict: 'slug' });

  if (error) return { ok: false, inserted: 0, errors: [{ row: 0, message: error.message }] };

  revalidatePath('/');
  revalidatePath('/explore');
  revalidatePath('/admin');
  return { ok: true, inserted: rows.length, errors: [] };
}

/** Minimal RFC-4180 CSV reader — handles quoted fields and embedded commas. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!header) return [];

  return body.map((cells) =>
    Object.fromEntries(
      header.map((key, i) => [key.trim(), (cells[i] ?? '').trim()])
    )
  );
}

/* ==================================================================== *
 * Crowd controls (§58)
 *
 * Same rule as every action above: a Server Action is a public HTTP
 * endpoint, so authorization is re-checked here rather than assumed from
 * the fact that the page rendered.
 * ==================================================================== */

export async function toggleMandalReportingAction(
  mandalId: string,
  enabled: boolean
): Promise<ActionResult> {
  const denied = await authorize();
  if (denied) return denied;

  const id = z.string().uuid().safeParse(mandalId);
  if (!id.success) return { ok: false, error: 'Unknown mandal.' };

  try {
    const { setMandalReporting } = await import('@/services/crowd/crowd-admin');
    await setMandalReporting(id.data, enabled);
  } catch {
    return { ok: false, error: 'Could not change reporting for this mandal.' };
  }

  revalidatePath('/admin/crowd');
  return {
    ok: true,
    message: enabled ? 'Reporting enabled.' : 'Reporting disabled.',
  };
}

export async function blockDeviceAction(
  deviceId: string,
  reason: string
): Promise<ActionResult> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = z
    .object({ deviceId: z.string().uuid(), reason: z.string().min(3).max(200) })
    .safeParse({ deviceId, reason });
  if (!parsed.success) return { ok: false, error: 'Invalid block request.' };

  const admin = await requireAdmin();

  try {
    const { blockDevice } = await import('@/services/crowd/crowd-admin');
    // Time-boxed by default. An indefinite block on an identifier the
    // owner can regenerate in one tap is mostly theatre; a 7-day block
    // costs an abuser real effort and cannot strand an honest user
    // forever.
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await blockDevice(parsed.data.deviceId, parsed.data.reason, until, admin.id);
  } catch {
    return { ok: false, error: 'Could not block this device.' };
  }

  revalidatePath('/admin/crowd');
  return { ok: true, message: 'Device blocked for 7 days.' };
}

export async function unblockDeviceAction(deviceId: string): Promise<ActionResult> {
  const denied = await authorize();
  if (denied) return denied;

  const id = z.string().uuid().safeParse(deviceId);
  if (!id.success) return { ok: false, error: 'Invalid device.' };

  try {
    const { unblockDevice } = await import('@/services/crowd/crowd-admin');
    await unblockDevice(id.data);
  } catch {
    return { ok: false, error: 'Could not unblock this device.' };
  }

  revalidatePath('/admin/crowd');
  return { ok: true, message: 'Device unblocked.' };
}
