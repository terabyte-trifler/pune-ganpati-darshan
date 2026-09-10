-- =====================================================================
-- Tell temples apart from festival pandals.
--
-- The catalogue holds both and called them all mandals. That misdescribes
-- the entry and the visit: a pandal is put up for Ganeshotsav by a mandal
-- — a neighbourhood association — and comes down after, and the dekhava,
-- the mandap and the ten-day queue are the whole of it. A temple is open
-- all year and has no mandal behind it.
--
-- Raised by the owner about Sarasbaug: "siddhivinayak sarasbaug is a
-- temple not a pandal mandal". It was listed as a 'famous' mandal, which
-- is a festival-mandal category, so the app presented a year-round temple
-- as a pandal.
--
-- ---------------------------------------------------------------------
-- Why a column and not the existing 'temple' tag.
--
-- Because that tag does not mean this. Dagdusheth carries it and is
-- emphatically a mandal: it has a permanent temple AND a festival pandal,
-- and during the festival the pandal is the thing people queue for. Kasba
-- Ganpati is the same case and is additionally the first of the Manache
-- Paach. Deriving is_temple from the tag would reclassify both, which is
-- a worse error than the one being fixed.
--
-- Only an entry with no festival pandal at all belongs here.
--
-- ---------------------------------------------------------------------
-- Three rows.
--
--   sarasbaug-ganpati         The owner said so.
--   trishund-ganpati-mandir   The owner said so.
--   shri-morya-gosavi         Unambiguous: the Chinchwad temple, 15 km
--                             from the peths, already described in its own
--                             curated route as "the Chinchwad temple, as
--                             its own trip rather than a peth stop".
--
-- One more is plausible and is deliberately NOT set here, because the
-- evidence is its name and nothing else, and a name is how Dagdusheth
-- would have been got wrong too:
--
--   phani-ali-ganesh-mandir   Phani Ali Ganesh Mandir, Kasba Peth
--
-- If it is a temple, add it to the update below — the column and every
-- behaviour hanging off it already exist, so it is a one-line change.
-- =====================================================================

alter table ganpatis
  add column if not exists is_temple boolean not null default false;

comment on column ganpatis.is_temple is
  'A year-round temple with no festival pandal. NOT the same as the '
  '''temple'' tag, which also marks mandals that happen to have a '
  'permanent temple (Dagdusheth, Kasba Ganpati).';

update ganpatis
   set is_temple = true
 where slug in (
   'sarasbaug-ganpati',
   'trishund-ganpati-mandir',
   'shri-morya-gosavi'
 );

-- ---------------------------------------------------------------------
-- Proof, in the same transaction.
--
-- The failure this guards is a slug typo silently marking nothing, which
-- looks identical to success and leaves a temple listed as a pandal.
-- ---------------------------------------------------------------------
do $$
declare
  v_temples integer;
  v_dagdusheth boolean;
begin
  select count(*) into v_temples from ganpatis where is_temple;
  if v_temples <> 3 then
    raise exception 'Expected exactly 3 temples, found %', v_temples;
  end if;

  -- The specific mistake the tag-based approach would have made.
  select is_temple into v_dagdusheth
    from ganpatis where slug = 'dagdusheth-halwai-ganpati';
  if v_dagdusheth then
    raise exception 'Dagdusheth marked as a temple; it is a mandal with a temple';
  end if;

  raise notice 'Verified: 3 temples, and no pandal misclassified as one.';
end $$;
