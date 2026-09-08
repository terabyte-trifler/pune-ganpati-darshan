import { NextResponse } from 'next/server';
import { getCrowdStatuses, CrowdUnavailableError } from '@/services/crowd/crowd-service';
import { cachedJson, timed } from '@/services/crowd/crowd-http';
import { batchBodySchema, parseMandalIdList } from '@/services/crowd/crowd-validation';

/**
 * Crowd state for a set of mandals (§21).
 *
 * GET with `?mandalIds=a,b,c` is the form the map uses: it is cacheable by
 * the CDN, which a POST is not. POST exists for callers with more ids than
 * fit comfortably in a URL, and is explicitly not cached.
 *
 * Both forms are bounded at 100 ids, so a caller cannot turn one request
 * into unbounded work (§52).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return timed(async () => {
    const ids = parseMandalIdList(new URL(request.url).searchParams.get('mandalIds'));
    if (!ids) {
      return NextResponse.json(
        { error: 'invalid_request' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    try {
      return cachedJson({ items: await getCrowdStatuses(ids) }, request);
    } catch (error) {
      if (error instanceof CrowdUnavailableError) {
        return NextResponse.json(
          { error: 'Crowd information temporarily unavailable' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      throw error;
    }
  });
}

export async function POST(request: Request) {
  return timed(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const parsed = batchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    try {
      const items = await getCrowdStatuses(parsed.data.mandalIds);
      return NextResponse.json(
        { items },
        // A POST body is not a cache key any shared cache should trust.
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      if (error instanceof CrowdUnavailableError) {
        return NextResponse.json(
          { error: 'Crowd information temporarily unavailable' },
          { status: 503 }
        );
      }
      throw error;
    }
  });
}
