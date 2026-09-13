-- =====================================================================
-- Promoting the dwell signal: giving it an identity, narrowly.
--
-- 20260913120000_crowd_dwell_shadow.sql chose device-less rows and said
-- why, and it also said this:
--
--   THIS DECISION DOES NOT SURVIVE PROMOTION. The moment a dwell signal
--   is allowed to influence anything a visitor sees, gaming it becomes
--   worthwhile and deduplication becomes necessary — and that is the
--   point at which the device-keyed question has to be answered properly
--   rather than inherited from this file.
--
-- This is that point. Dwell is about to be able to colour a mandal with
-- no human report behind it, which makes the endpoint worth attacking:
-- it has no cooldown and no idempotency, so without an identity one
-- caller could paint any of the 25 zoned mandals red and leave nothing
-- behind to block.
--
-- ---------------------------------------------------------------------
-- Answering it properly: a key, not an id.
--
-- The obvious move is to copy crowd_reports and store the raw device id.
-- That buys deduplication and abuse resistance and hands over exactly
-- what the shadow migration refused to create: (device, mandal, time)
-- rows are a record of where somebody spent their evening.
--
-- So what is stored is not the device id but a digest of
--
--     device id + mandal id + the IST date + a server-side salt
--
-- computed in the route, where the raw id already is. The properties
-- that matter:
--
--   - Deduplication works. The same phone at the same mandal on the same
--     evening produces the same key, so aggregation can count devices
--     rather than rows.
--   - It cannot be joined across mandals. Two rows for the same person at
--     Kasba and at Tulshibaug carry unrelated keys, so this table still
--     cannot be assembled into anybody's route through the peths.
--   - It cannot be joined across days. The key rotates at IST midnight,
--     so it is not a festival-long identifier either.
--   - It cannot be tested against a device id by anyone who obtains the
--     table, because the salt is not in it.
--
-- What it deliberately does NOT buy: blocking from this table. A blocked
-- device is caught in the route, against crowd_device_blocks, using the
-- raw id — before the key is computed. The block list stays the one
-- place a device id lives, which is where it already was.
--
-- Still no coordinates. That has not changed and must not.
-- ---------------------------------------------------------------------

alter table crowd_dwell_samples
  add column if not exists device_key text;

-- Null for every row written in shadow mode. Those rows keep their
-- calibration value and are simply not countable as devices — the
-- aggregation treats a null key as its own device, which is the old
-- behaviour rather than a silent downgrade to zero.
comment on column crowd_dwell_samples.device_key is
  'Per (device, mandal, IST day) digest. Not a device id: cannot be joined across mandals or days, and cannot be reversed without the route''s salt.';

-- Counting distinct devices in a 90-minute window is now the hot query.
create index if not exists crowd_dwell_samples_mandal_device_idx
  on crowd_dwell_samples (mandal_id, created_at desc, device_key);

-- =====================================================================
-- Self-verification.
-- =====================================================================
do $$
declare
  has_key   int;
  has_coord int;
  rls_on    boolean;
begin
  select count(*) into has_key
  from information_schema.columns
  where table_name = 'crowd_dwell_samples' and column_name = 'device_key';
  if has_key <> 1 then
    raise exception 'crowd_dwell_samples: device_key was not added';
  end if;

  -- The one rule that survives every revision of this table.
  select count(*) into has_coord
  from information_schema.columns
  where table_name = 'crowd_dwell_samples'
    and column_name in ('lat', 'lng', 'latitude', 'longitude', 'accuracy', 'postal_code');
  if has_coord > 0 then
    raise exception 'crowd_dwell_samples: a coordinate column exists; see the shadow migration header';
  end if;

  -- And the device id itself must never appear here.
  select count(*) into has_coord
  from information_schema.columns
  where table_name = 'crowd_dwell_samples' and column_name = 'device_id';
  if has_coord > 0 then
    raise exception 'crowd_dwell_samples: raw device_id column exists; only device_key is permitted';
  end if;

  select relrowsecurity into rls_on from pg_class where relname = 'crowd_dwell_samples';
  if not rls_on then
    raise exception 'crowd_dwell_samples: RLS is not enabled';
  end if;

  raise notice 'crowd_dwell_samples: device_key added, no device_id, no coordinates, RLS on';
end $$;
