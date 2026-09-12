-- =====================================================================
-- Mark which dwell samples carry a meaningful duration.
--
-- The bug this fixes, found by asking how dwell_seconds was calculated.
--
-- The clock feeding the tracker (useClockMs) is quantised to 30 seconds,
-- and both dwell thresholds — 90s and 360s — are multiples of 30. A
-- sample is emitted on the first tick that crosses a threshold. So the
-- recorded duration was always exactly 90 or exactly 360, and the column
-- carried nothing the class did not already carry. Someone who stood for
-- fourteen minutes and someone who stood for six produced the identical
-- row.
--
-- The fix is a second kind of sample, written when the device is
-- confirmed to have LEFT the zone, carrying the whole visit's duration.
-- That is where the real magnitude lives, and magnitude is the part of
-- this signal that is independent of how many users the app has.
--
-- Both kinds are kept, and that needs saying. Without a device id there
-- is no way to group rows into visits, so an exit row cannot be matched
-- to the threshold rows that preceded it. `is_final` is what lets an
-- analysis separate them:
--
--   is_final = false  — a threshold marker. The duration is the
--                       threshold, not an observation. Count these for
--                       volume and for the queueing:lingering ratio.
--   is_final = true   — one per completed visit, with the real duration.
--                       Use only these for distributions and medians.
--
-- Keeping the markers matters for a reason that is easy to miss: a visit
-- only produces an exit row if the page is still open when the device
-- leaves. The longest queues are exactly the ones where someone gives up
-- and closes the tab, so dropping the markers would bias the data against
-- the heaviest crowds — which are the ones worth detecting.
-- =====================================================================

alter table crowd_dwell_samples
  add column if not exists is_final boolean not null default false;

-- Exit rows are the ones read for distributions, so they get the index.
create index if not exists crowd_dwell_samples_final_idx
  on crowd_dwell_samples (mandal_id, created_at desc)
  where is_final;

do $$
declare
  has_col boolean;
  has_coords boolean;
  has_device boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_name = 'crowd_dwell_samples' and column_name = 'is_final'
  ) into has_col;
  if not has_col then
    raise exception 'crowd_dwell_samples.is_final was not added';
  end if;

  -- The two invariants the first migration established, re-checked: this
  -- table must never learn who or where.
  select exists (
    select 1 from information_schema.columns
    where table_name = 'crowd_dwell_samples'
      and column_name in ('lat','lng','latitude','longitude','accuracy_m')
  ) into has_coords;
  if has_coords then
    raise exception 'crowd_dwell_samples must never hold coordinates';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_name = 'crowd_dwell_samples'
      and column_name in ('device_id','session_id','ip','ip_hash')
  ) into has_device;
  if has_device then
    raise exception 'crowd_dwell_samples is device-less by design';
  end if;

  raise notice 'crowd_dwell_samples.is_final added; still no coordinates, still no device id';
end $$;
