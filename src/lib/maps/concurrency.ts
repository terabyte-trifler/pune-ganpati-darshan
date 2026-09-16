/**
 * Run independent async work at the same time, but not all at once.
 *
 * The router calls behind one plan are mostly independent of each other —
 * the chunks of a long route, the repair of one leg against the repair of
 * another — and they were being made one after the next. Measured on
 * /api/routes: fifteen stops cost nineteen calls and 9.6 s, of which 97%
 * was waiting. Waiting in parallel costs the same upstream and a fraction
 * of the wall clock.
 *
 * Capped rather than unbounded. The default router is a public instance
 * run by volunteers, and answering a burst of twenty is not a courtesy it
 * owes us; four at a time keeps the wall clock short without turning one
 * visitor's plan into a small flood.
 */
export const ROUTER_CONCURRENCY = 4;

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length <= 1) {
    return items.length === 1 ? [await fn(items[0], 0)] : [];
  }

  const out = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return out;
}
