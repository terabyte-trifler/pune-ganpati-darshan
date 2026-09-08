import { NextResponse } from 'next/server';
import { getCrowdStatus, CrowdUnavailableError } from '@/services/crowd/crowd-service';
import { cachedJson, timed } from '@/services/crowd/crowd-http';
import { mandalIdSchema } from '@/services/crowd/crowd-validation';

/** Crowd state for one mandal, served from the shared city snapshot. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mandalId: string }> }
) {
  return timed(async () => {
    const { mandalId } = await params;

    // Shape-check before anything else. An id that is not a UUID never
    // reaches the service, the database, or a cache key (§53).
    const parsed = mandalIdSchema.safeParse(mandalId);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_request' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    try {
      const status = await getCrowdStatus(parsed.data);
      if (!status) {
        // Unknown ids are indistinguishable from a mandal with no reports
        // as far as timing goes, but a 404 is the honest answer and it
        // gives an enumeration attempt nothing a public page lacks.
        return NextResponse.json(
          { error: 'not_found' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      return cachedJson(status, request);
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
