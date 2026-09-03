-- ═════════════════════════════════════════════════════════════════════════════
-- CRM LEAD PINCODE BACKFILL — ROUND 2 (generated 2026-09-03)
--
-- Completes the pincode enrichment after backfill_crm_historical_leads_2026-09-03.sql.
-- Round 1 deliberately touched only leads whose status was 'new' at run time,
-- which left 8 fillable pincodes behind:
--   * 6 leads the team had already worked (5 contacted, 1 follow_up) whose sheet
--     rows DO carry a pincode + address — filled here from the sheet
--   * 2 newer auto-imported leads (Yelahanka / Rt nagar) — pinned from the
--     workbook's pincode_reference tab (city → pincode lookup)
-- Still NOT fillable (nothing in the workbook): the 76 "still_missing" rows —
-- their sheet address answer is junk ("Yes", "Grooming", pet names) and the
-- pincode cell is empty — plus 3 leads with no location info at all.
-- 2 leads keep their staff-entered DB pincode where the sheet disagrees
-- (560067 vs 560066, 563157 vs 563101) — fill-only-missing policy.
--
-- Same guarantees as round 1: single transaction, idempotent (COALESCE +
-- snapshot guard), every change logged as a location_updated activity with
-- metadata.backfill = 'historical_sheet'. Run once in the Supabase SQL editor.
--
-- EXPECTED OUTCOME: 8 pincodes filled (316 → 324 leads with pincode),
-- up to 6 addresses filled, 8 location_updated activities.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TABLE IF EXISTS _pin_fill;
CREATE TEMP TABLE _pin_fill (
  db_external_id text NOT NULL,
  pincode        text NOT NULL,
  address        text,            -- NULL = leave the lead's address alone
  source         text NOT NULL    -- 'sheet' | 'pincode_reference'
);

INSERT INTO _pin_fill (db_external_id, pincode, address, source) VALUES
  ('lead:l:1389905915840456', '560005', 'Haines road',           'sheet'),
  ('lead:l:928330716460167',  '560076', 'Jp nagar 8th phase',    'sheet'),
  ('lead:l:1602849558210642', '560077', 'Kadasonapanahalli',     'sheet'),
  ('lead:l:1560702178876569', '562110', 'Devanhalli',            'sheet'),
  ('lead:l:1805013504285356', '560064', 'Yelahanka',             'sheet'),
  ('lead:l:1613763693451769', '560078', 'Kumarswamy layout',     'sheet'),
  ('lead:l:2467561830416111', '560064', NULL, 'pincode_reference'),  -- city: Yelahanka
  ('lead:l:1314038137049386', '560032', NULL, 'pincode_reference');  -- city: Rt nagar

-- Snapshot the targets (fill only where the DB value is still missing).
DROP TABLE IF EXISTS _pin_targets;
CREATE TEMP TABLE _pin_targets AS
SELECT f.db_external_id, f.pincode, f.address, f.source,
       l.id      AS lead_id,
       l.pincode AS db_pincode,
       l.address AS db_address
FROM _pin_fill f
JOIN crm_leads l ON l.external_lead_id = f.db_external_id
WHERE (l.pincode IS NULL)
   OR (l.address IS NULL AND f.address IS NOT NULL);

-- Fill (never overwrite).
UPDATE crm_leads l
SET pincode       = COALESCE(l.pincode, t.pincode),
    address       = COALESCE(l.address, t.address),
    last_activity_at = now()
FROM _pin_targets t
WHERE l.id = t.lead_id;

-- Activity log — same shape the app service writes.
INSERT INTO crm_lead_activities (lead_id, actor_id, activity_type, body, metadata)
SELECT t.lead_id, NULL, 'location_updated'::crm_lead_activity_type,
       'Lead location updated: '
         || concat_ws(', ',
              CASE WHEN t.db_pincode IS NULL THEN 'pincode → ' || t.pincode END,
              CASE WHEN t.db_address IS NULL AND t.address IS NOT NULL THEN 'address → ' || t.address END)
         || '.',
       jsonb_build_object(
         'backfill', 'historical_sheet',
         'external_lead_id', t.db_external_id,
         'source', t.source)
FROM _pin_targets t;

COMMIT;

-- ─── Verification ───
SELECT count(*) AS leads_with_pincode,
       count(*) FILTER (WHERE address IS NOT NULL) AS leads_with_address,
       count(*) AS leads_total
FROM crm_leads;

SELECT activity_type, count(*) AS activities
FROM crm_lead_activities
WHERE metadata->>'backfill' = 'historical_sheet'
GROUP BY activity_type
ORDER BY activity_type;
