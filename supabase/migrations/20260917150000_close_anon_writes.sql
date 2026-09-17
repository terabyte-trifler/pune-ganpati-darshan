-- =====================================================================
-- Close the two tables the public key could write to directly.
--
-- Found by probing production with NEXT_PUBLIC_SUPABASE_ANON_KEY, which
-- ships in the client bundle by design and is therefore known to anyone
-- who opens devtools:
--
--   POST /rest/v1/analytics_events      -> 201 Created
--   POST /rest/v1/crowd_dwell_samples   -> 201 Created
--
-- Every other table answered 401. These two were open because of
--
--   create policy analytics_insert_any on analytics_events
--     for insert with check (true);
--
-- and its counterpart on crowd_dwell_samples, written when the browser
-- was expected to post telemetry straight to PostgREST.
--
-- It does not. `services/analytics.ts` sends to /api/analytics via
-- sendBeacon and `useDwellSignal.ts` fetches /api/crowd/dwell; both route
-- handlers write with the service-role key, which bypasses RLS entirely
-- and is unaffected by anything below. The policies have been dead weight
-- since that changed, and what they left behind is an unauthenticated,
-- unvalidated, unrate-limited INSERT into the two fastest-growing tables
-- in the database.
--
-- What that was worth to an attacker:
--
--   * Fill the database. analytics_events is already the table projected
--     to breach Supabase's 500 MB free limit before visarjan on growth
--     from real traffic alone. A script could do it in an afternoon, and
--     a full database stops the crowd system for everyone.
--   * Poison every reading. Rows inserted here skip the validation in
--     /api/analytics and /api/crowd/dwell — arbitrary event names, and
--     dwell samples with any mandal_id, duration and device_key. Dwell
--     feeds crowd colour, so forged rows could colour a mandal.
--   * Store anything in `props`, including data the app is careful never
--     to collect.
--
-- Removing the policy is sufficient: with RLS enabled and no INSERT
-- policy for anon, PostgREST refuses. The grants go too, so the refusal
-- does not depend on policy evaluation alone.
-- =====================================================================

drop policy if exists analytics_insert_any on analytics_events;
drop policy if exists crowd_dwell_samples_insert on crowd_dwell_samples;

revoke insert on analytics_events    from anon, authenticated;
revoke insert on crowd_dwell_samples from anon, authenticated;

-- RLS stays on; the admin read policies are untouched.
alter table analytics_events     enable row level security;
alter table crowd_dwell_samples  enable row level security;
