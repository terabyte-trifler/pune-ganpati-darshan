-- =====================================================================
-- Passive dwell samples. Shadow mode: recorded, never displayed.
--
-- The question this table exists to answer, over one festival: does how
-- long devices linger near a mandal agree with what people report about
-- its queue? If it does, dwell earns a weight. If it does not, it is
-- deleted and nothing was ever shown to anyone on the strength of it.
--
-- ---------------------------------------------------------------------
-- THE PRIVACY DECISION, MADE DELIBERATELY AND NARROWLY.
--
-- There were two ways to store this:
--
--   (a) device-keyed rows — (device_id, mandal_id, dwell, at). Gives
--       deduplication and abuse resistance, and gives something else
--       nobody asked for: a location history. (device, mandal, time)
--       rows are a record of where a person spent their evening, with or
--       without a latitude in them.
--
--   (b) device-less rows — (mandal_id, dwell, at). No deduplication, no
--       abuse resistance, and nothing that can be linked across mandals
--       or across time to a person.
--
-- (b) is chosen, because in shadow mode the thing (a) buys is worth
-- nothing. Nothing here is displayed, so there is no incentive to game it
-- and no harm if someone does; the only cost of a spammer is a noisier
-- calibration set, which is visible in the data itself. Paying for
-- abuse resistance with a presence log would be buying a defence against
-- a harm that does not exist yet with a harm that does.
--
-- THIS DECISION DOES NOT SURVIVE PROMOTION. The moment a dwell signal is
-- allowed to influence anything a visitor sees, gaming it becomes
-- worthwhile and deduplication becomes necessary — and that is the point
-- at which the device-keyed question has to be answered properly rather
-- than inherited from this file.
--
-- ---------------------------------------------------------------------
-- One thing this table cannot express, and the reader must know it.
--
-- Two pairs of mandals sit closer than any radius can separate (Kasba and
-- Phani Ali 30 m apart, Bhausaheb Rangari and Balvikas 37 m). Rather than
-- discarding all four, the more prominent of each pair absorbs the other
-- — see features/crowd/pace.ts. So a row against Kasba may describe
-- someone who was at Phani Ali, and a row against Bhausaheb Rangari may
-- describe someone at Balvikas. There is no column for that here; the
-- zone's `absorbs` list is where it is recorded, and any analysis of this
-- table has to read those two mandals as pairs.
--
-- Note also what is NOT here and must never be added: coordinates. The
-- client resolves which mandal it is near on the device and sends only
-- the mandal id, exactly as `atMandal` already works. A latitude in this
-- table would defeat the whole arrangement.
--
-- ---------------------------------------------------------------------
-- Why append-only rather than a counter.
--
-- A counter per mandal per bucket would be smaller and even less
-- revealing. But the calibration needs the time distribution — whether
-- dwell leads or lags the human reports, and by how long — and a bucketed
-- counter throws exactly that away. Rows are anonymous, so the finer
-- grain costs nothing that (b) was protecting.
-- =====================================================================

create table if not exists crowd_dwell_samples (
  id          bigserial primary key,
  mandal_id   uuid not null references ganpatis(id) on delete cascade,
  -- 'lingering' | 'queueing'. 'passing' is never recorded: someone
  -- walking past a mandal is not evidence about its queue, and it is the
  -- overwhelming majority case, so storing it would bury the signal.
  dwell       text not null check (dwell in ('lingering', 'queueing')),
  -- Seconds inside the zone when this was emitted. The useful number for
  -- calibration; the class alone loses the magnitude.
  dwell_seconds integer not null check (dwell_seconds >= 0 and dwell_seconds < 86400),
  created_at  timestamptz not null default now()
);

create index if not exists crowd_dwell_samples_mandal_time_idx
  on crowd_dwell_samples (mandal_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS. Insert-only for anon, exactly like analytics_events: the browser
-- must be able to contribute and must never be able to read back. Reads
-- go through the service role, which is admin-only surface.
-- ---------------------------------------------------------------------
alter table crowd_dwell_samples enable row level security;

drop policy if exists crowd_dwell_samples_insert on crowd_dwell_samples;
create policy crowd_dwell_samples_insert
  on crowd_dwell_samples for insert
  to anon, authenticated
  with check (true);

-- No select policy on purpose. Without one, RLS denies every read to
-- anon and authenticated, and the absence is the policy.

-- =====================================================================
-- Self-verification. A migration that cannot prove it worked is a
-- migration someone has to check by hand.
-- =====================================================================
do $$
declare
  col_count int;
  has_coords boolean;
  has_device boolean;
  rls_on boolean;
  select_policies int;
begin
  select count(*) into col_count
  from information_schema.columns
  where table_name = 'crowd_dwell_samples';

  if col_count <> 5 then
    raise exception 'crowd_dwell_samples: expected 5 columns, found %', col_count;
  end if;

  -- The two things this table must never grow.
  select exists (
    select 1 from information_schema.columns
    where table_name = 'crowd_dwell_samples'
      and column_name in ('lat', 'lng', 'latitude', 'longitude', 'accuracy_m')
  ) into has_coords;
  if has_coords then
    raise exception 'crowd_dwell_samples must never hold coordinates';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_name = 'crowd_dwell_samples'
      and column_name in ('device_id', 'session_id', 'ip', 'ip_hash')
  ) into has_device;
  if has_device then
    raise exception 'crowd_dwell_samples is device-less by design; see the header';
  end if;

  select relrowsecurity into rls_on
  from pg_class where relname = 'crowd_dwell_samples';
  if not rls_on then
    raise exception 'crowd_dwell_samples: RLS is not enabled';
  end if;

  select count(*) into select_policies
  from pg_policies
  where tablename = 'crowd_dwell_samples' and cmd = 'SELECT';
  if select_policies <> 0 then
    raise exception 'crowd_dwell_samples: a SELECT policy exists; the browser must not read this back';
  end if;

  raise notice 'crowd_dwell_samples: 5 columns, no coordinates, no device id, RLS on, insert-only';
end $$;
