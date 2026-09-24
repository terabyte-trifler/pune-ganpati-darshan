-- analytics_events had no index on created_at alone.
--
-- Every index on the table leads with something else — name, ganpati_id,
-- city, referrer — so none of them serve a bare range scan on the
-- timestamp. `traffic_origin_overview()` filters on exactly that, in
-- several subqueries, and each one was scanning the whole table.
--
-- Measured 24 Sep 2026 at 300,529 rows: the 5-day window the admin page
-- asks for took about 7 seconds, against a statement timeout of 8. It had
-- already tipped over once that afternoon, and visarjan traffic will
-- roughly double the table overnight.
--
-- Note this only narrows the scan when the window is a real slice of the
-- table. When the window covers nearly everything, the honest fix is to
-- restructure the function to a single pass with FILTER aggregates
-- instead of one subquery per panel.

create index if not exists analytics_events_created_at_idx
  on analytics_events (created_at desc);
