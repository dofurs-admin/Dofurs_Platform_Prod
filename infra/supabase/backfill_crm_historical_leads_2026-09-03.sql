-- ═════════════════════════════════════════════════════════════════════════════
-- CRM HISTORICAL LEAD BACKFILL — generated 2026-09-03 from
-- crm_historical_lead_update_sheet_complete.xlsx (tab: crm_lead_updates)
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- It is a single transaction (BEGIN…COMMIT): either everything applies or nothing does.
-- It is IDEMPOTENT: safe to re-run — the status guard, COALESCE fills and note
-- dedupe make every statement a no-op on a second run.
--
-- WHAT IT DOES — only for crm_leads rows whose CURRENT status is 'new':
--   * pincode  → filled from the sheet where the column is still NULL
--                (existing values are never overwritten)
--   * address  → filled the same way; the sheet's own unresolved rows
--                (pincode_confidence 'review' with no pincode — the
--                "still_missing" set) and junk answers ("Yes", "Call me", …)
--                are deliberately excluded
--   * status   → set to the sheet's status_to_set, mirroring the app service:
--                first_contacted_at stamped on the first working state,
--                lost_reason mapped onto the fixed UI vocabulary,
--                next_followup_at cleared on lost/cancelled/converted, and a
--                best-effort converted_booking_id link to the customer's
--                earliest platform booking on/after the lead date
--   * remarks  → added verbatim as 'note' activities on each lead timeline
--   * every change is activity-logged (location_updated / status_change /
--     lost / converted / note) with actor_id NULL and
--     metadata.backfill = 'historical_sheet' — the same automated-actor
--     pattern the Meta sheet importer uses
--
-- NOT TOUCHED: leads already past 'new' (8 matched rows), the 2 test-dummy
-- rows, existing pincode/address values, assignments, priorities, follow-ups.
--
-- EXPECTED OUTCOME (measured against the live DB at generation time):
--   leads touched:          379
--   pincode fills:          313
--   address fills:          314   (sheet rows with no usable location excluded)
--   status transitions:     converted 34 | contacted 102 | lost 9
--   lost reasons:           Out of coverage area 5 | Customer don't have pet. 1 | customer don't have pet 1 | Booked elsewhere 1 | Not interested 1
--   converted booking link: 24 linked · 10 without a platform booking (flagged on the timeline)
--   remark notes:           324
--   leads with nothing:     11
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1) Staging: the prepared sheet data, resolved to DB lead ids ───
DROP TABLE IF EXISTS _sheet_updates;
CREATE TEMP TABLE _sheet_updates (
  db_external_id     text NOT NULL,   -- crm_leads.external_lead_id ('lead:l:…' / 'sheet:…')
  pincode            text,
  address            text,
  status_to_set      text NOT NULL,   -- valid crm_lead_status label
  lost_reason        text,
  remarks            text,
  sheet_created_at   timestamptz,     -- Meta created_time (booking linkage window)
  pincode_confidence text,
  pincode_source     text
);

INSERT INTO _sheet_updates (db_external_id, pincode, address, status_to_set, lost_reason, remarks, sheet_created_at, pincode_confidence, pincode_source) VALUES
  ('lead:l:1025847046489200', '560086', 'Mahalakshmi layout', 'new', NULL, NULL, '2026-06-29T00:35:42-05:00', 'medium', NULL),
  ('lead:l:27205562482458008', NULL, NULL, 'new', NULL, NULL, '2026-06-19T07:07:36-05:00', 'review', NULL),
  ('lead:l:992435493798892', '560091', 'Sukandakatte Bangalore', 'new', NULL, NULL, '2026-06-20T00:28:02-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1669414001026064', '560099', 'Hale chandapura', 'converted', NULL, NULL, '2026-06-20T02:39:08-05:00', 'medium', NULL),
  ('lead:l:1014884571498361', '560068', 'Kas officers colony', 'converted', NULL, NULL, '2026-06-20T03:46:23-05:00', 'review', NULL),
  ('lead:l:1475359807731102', '560066', 'Whitefield', 'new', NULL, NULL, '2026-06-21T00:35:00-05:00', 'medium', NULL),
  ('lead:l:1299523805278490', '560024', 'Hebbal', 'new', NULL, NULL, '2026-06-21T08:20:54-05:00', 'medium', NULL),
  ('lead:l:1547085600447652', '560004', 'Jaynagar shastri nagar', 'new', NULL, NULL, '2026-06-21T11:22:27-05:00', 'review', NULL),
  ('lead:l:955620077532366', '573201', 'Hassan 573201', 'new', NULL, NULL, '2026-06-21T12:17:48-05:00', 'high', NULL),
  ('lead:l:2170902977095934', '560073', 'Nagasandra', 'new', NULL, NULL, '2026-06-21T13:33:44-05:00', 'medium', NULL),
  ('lead:l:4304147056511576', '560064', 'Yelahanka', 'new', NULL, NULL, '2026-06-21T15:13:50-05:00', 'medium', NULL),
  ('lead:l:999049136353349', '560036', 'Krpuram', 'new', NULL, NULL, '2026-06-21T23:58:59-05:00', 'medium', NULL),
  ('lead:l:4456987614545048', '560099', 'Rayasandra Circle', 'new', NULL, NULL, '2026-06-22T01:51:20-05:00', 'medium', NULL),
  ('lead:l:988339973824572', '560049', 'Bidarahalli', 'new', NULL, NULL, '2026-06-22T04:15:59-05:00', 'medium', NULL),
  ('lead:l:1413831587248375', '560068', 'Kudlu gate', 'new', NULL, NULL, '2026-06-22T05:46:31-05:00', 'medium', NULL),
  ('lead:l:1695402194841027', '560085', 'girinagar', 'new', NULL, NULL, '2026-06-23T04:29:22-05:00', 'medium', NULL),
  ('lead:l:1556088009223995', '560043', 'kalyan nagar', 'new', NULL, NULL, '2026-06-24T00:43:39-05:00', 'medium', NULL),
  ('lead:l:1390798269537348', '560068', 'Bommanahalli', 'new', NULL, NULL, '2026-06-24T03:16:06-05:00', 'medium', NULL),
  ('lead:l:1052954187085671', NULL, NULL, 'new', NULL, NULL, '2026-06-24T04:54:27-05:00', 'review', NULL),
  ('lead:l:2193623484791444', '560083', 'Bannerghatta', 'new', NULL, NULL, '2026-06-24T06:04:29-05:00', 'medium', NULL),
  ('lead:l:1961868185216240', NULL, NULL, 'converted', NULL, 'complete care for 1150', '2026-06-26T03:28:13-05:00', 'review', NULL),
  ('lead:l:1521053599759926', '560034', 'Pranith', 'contacted', NULL, 'customer inquiry about purchasing a pet.', '2026-06-25T09:20:52-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1049367317437963', '560023', 'K p Agrahara bhuvaneshwari nagar Magadi road Bangalore', 'contacted', NULL, 'customer will reach us in future', '2026-06-25T11:56:35-05:00', 'medium', NULL),
  ('lead:l:1323811383272299', '562114', 'Hoskote', 'lost', 'Out of coverage area', 'Out of banglore location', '2026-06-25T23:19:15-05:00', 'medium', NULL),
  ('lead:l:1764547144906398', '560010', 'Rajajinagar', 'contacted', NULL, 'customer will reach us in future', '2026-06-25T23:53:41-05:00', 'medium', NULL),
  ('lead:l:1659206048530436', '560029', 'Btm 1st stage', 'new', NULL, 'Customer didn''t pick up the call', '2026-06-25T23:55:37-05:00', 'medium', NULL),
  ('lead:l:1345741334340127', '562109', 'Bidadi', 'lost', 'Out of coverage area', 'Out of banglore location', '2026-06-26T02:30:55-05:00', 'medium', NULL),
  ('lead:l:1659664611983429', NULL, NULL, 'converted', NULL, 'essential grooming for 1000.', '2026-06-26T17:37:11-05:00', 'review', NULL),
  ('lead:l:1486159356644947', '560056', 'Sir m Vishweshwaraiya layout 3rd block', 'new', NULL, 'Customer will share the location and will update the details shortly', '2026-06-26T04:04:52-05:00', 'review', NULL),
  ('lead:l:1603851517974463', '560001', 'Bangalore Karnataka', 'lost', 'Customer don''t have pet.', 'Customer don''t have pet.', '2026-06-26T07:16:26-05:00', 'review', NULL),
  ('lead:l:2082203816037466', '560068', 'Hongasandra', 'new', NULL, 'Requested for location. Will book for 28/06/2026', '2026-06-26T07:41:34-05:00', 'medium', NULL),
  ('lead:l:1583465546471977', '562149', 'Baglur', 'lost', 'Out of coverage area', 'Out of banglore location', '2026-06-26T09:17:55-05:00', 'medium', NULL),
  ('lead:l:1330893159224726', '570001', 'Mysore', 'lost', 'Out of coverage area', 'Out of banglore location', '2026-06-26T12:01:43-05:00', 'medium', NULL),
  ('lead:l:1415295157035463', NULL, NULL, 'converted', NULL, NULL, '2026-06-29T23:20:28-05:00', 'review', NULL),
  ('lead:l:1540274437690743', '560100', 'Electronic City phase1', 'new', NULL, NULL, '2026-06-27T09:31:30-05:00', 'medium', NULL),
  ('lead:l:3936297966666510', '570001', 'Halle Mysore', 'new', NULL, NULL, '2026-06-27T09:45:04-05:00', 'medium', NULL),
  ('lead:l:1980221702627226', '560034', 'Koramangala', 'new', NULL, 'Bath and hygiene for 999. customer will share the location', '2026-06-27T11:37:39-05:00', 'medium', NULL),
  ('lead:l:2131699557399459', '571430', 'kanakapura road', 'new', NULL, NULL, '2026-06-27T13:52:07-05:00', 'review', NULL),
  ('lead:l:1717834846030098', '562107', 'Attibele', 'new', NULL, NULL, '2026-06-27T14:27:46-05:00', 'medium', NULL),
  ('lead:l:1005258498768073', NULL, NULL, 'new', NULL, NULL, '2026-06-27T18:51:04-05:00', 'review', NULL),
  ('lead:l:4666764910231717', NULL, NULL, 'new', NULL, NULL, '2026-06-27T20:32:26-05:00', 'review', NULL),
  ('lead:l:3473508342807092', NULL, NULL, 'lost', 'customer don''t have pet', 'customer don''t have pet', '2026-06-27T23:52:14-05:00', 'review', NULL),
  ('lead:l:1009245602024551', '577101', 'We in Chikmagalur', 'lost', 'Out of coverage area', 'more than 200 km', '2026-06-28T05:06:00-05:00', 'review', NULL),
  ('lead:l:1540745521010235', '560050', 'Banashankari', 'new', NULL, 'did not receive call', '2026-06-28T06:20:52-05:00', 'medium', NULL),
  ('lead:l:2460217437810298', '560072', 'Mudalapalya hair growing niles cut', 'contacted', NULL, 'talked with Shweta she will reply back once confirmed', '2026-06-28T06:56:11-05:00', 'review', NULL),
  ('lead:l:1352007296903152', '560077', 'Kothnur', 'new', NULL, 'did not receive call', '2026-06-28T08:36:18-05:00', 'review', NULL),
  ('lead:l:1508224316966467', '562125', 'Dommasandhra', 'contacted', NULL, 'reached out no reply, send text message', '2026-06-28T21:58:04-05:00', 'review', NULL),
  ('lead:l:1788214355671822', '560008', 'Koddile', 'new', NULL, 'CREATED', '2026-06-29T11:49:21-05:00', 'review', NULL),
  ('lead:l:1273912918150397', '560072', 'Nagarabhavi', 'new', NULL, NULL, '2026-06-29T23:02:50-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2544247776034759', '560029', 'SG Palya', 'converted', NULL, 'essential grooming for 2 cats', '2026-06-24T12:32:47-05:00', 'review', NULL),
  ('lead:l:27988053134167310', NULL, NULL, 'new', NULL, NULL, '2026-06-30T00:38:28-05:00', 'review', NULL),
  ('lead:l:1989609978352086', '560079', 'Basaveshwara', 'new', NULL, NULL, '2026-06-30T02:24:30-05:00', 'review', NULL),
  ('lead:l:1035665282137446', NULL, NULL, 'new', NULL, NULL, '2026-06-30T05:38:04-05:00', 'review', NULL),
  ('lead:l:1006364028947325', '560022', 'Yeshwanthpur', 'new', NULL, NULL, '2026-06-30T06:17:51-05:00', 'medium', NULL),
  ('lead:l:1489444019160874', '560040', 'Vijay nagar', 'new', NULL, NULL, '2026-06-30T08:01:31-05:00', 'medium', NULL),
  ('lead:l:2070100667719337', '560059', 'Near Dubasipalya Kengari', 'new', NULL, NULL, '2026-06-30T09:29:32-05:00', 'review', NULL),
  ('lead:l:1317736823743616', '562109', 'Amba Bavani temple road veeersandra', 'lost', 'Booked elsewhere', 'Customer have booked service some other vendor for 800', '2026-06-30T11:14:42-05:00', 'review', NULL),
  ('lead:l:1156543810021716', '560040', 'Vijaynagar', 'new', NULL, NULL, '2026-06-30T11:40:55-05:00', 'review', NULL),
  ('lead:l:2613724365709933', '560040', 'Chandra layout', 'new', NULL, NULL, '2026-06-30T12:49:50-05:00', 'medium', NULL),
  ('lead:l:2051977748759026', '560072', 'Nagarbhavi', 'new', NULL, NULL, '2026-07-01T01:00:19-05:00', 'medium', NULL),
  ('lead:l:2032296667646024', '560085', 'BSK', 'new', NULL, NULL, '2026-07-01T02:37:40-05:00', 'review', NULL),
  ('lead:l:3284725728366649', '560073', 'Nagasandra', 'new', NULL, NULL, '2026-07-01T05:32:13-05:00', 'medium', NULL),
  ('lead:l:1499069918127318', NULL, NULL, 'new', NULL, NULL, '2026-07-03T01:24:01-05:00', 'review', NULL),
  ('lead:l:1678928006669557', '560051', 'Shivaji Nagar', 'new', NULL, NULL, '2026-07-03T02:30:45-05:00', 'medium', NULL),
  ('lead:l:2136017550322661', '562114', 'Hoskote', 'new', NULL, NULL, '2026-07-03T02:54:03-05:00', 'medium', NULL),
  ('lead:l:883591170963939', '560087', 'Varthur', 'new', NULL, NULL, '2026-07-03T04:35:40-05:00', 'medium', NULL),
  ('lead:l:958355970566506', '560119', 'V nagenahalli Bangalore', 'new', NULL, NULL, '2026-07-03T05:38:27-05:00', 'review', NULL),
  ('lead:l:842697512053900', '560023', 'Magadi road', 'new', NULL, NULL, '2026-07-03T06:25:48-05:00', 'medium', NULL),
  ('lead:l:4607006849579753', '560066', 'Samethanahalli near Whitefield', 'new', NULL, NULL, '2026-07-03T08:23:24-05:00', 'medium', NULL),
  ('lead:l:1064368689259265', '560002', 'Kanakapura road thatguani agara near swandashrma', 'new', NULL, NULL, '2026-07-03T10:08:02-05:00', 'review', NULL),
  ('lead:l:4596996370572874', '560045', 'Kg halli', 'new', NULL, NULL, '2026-07-03T21:43:44-05:00', 'review', NULL),
  ('lead:l:1029083576416175', '560034', 'Koramangala', 'new', NULL, NULL, '2026-07-03T23:06:49-05:00', 'medium', NULL),
  ('lead:l:2194260607781454', NULL, NULL, 'new', NULL, NULL, '2026-07-04T07:01:39-05:00', 'review', NULL),
  ('lead:l:992908710282699', '560016', 'Ramurthy nagar', 'new', NULL, NULL, '2026-07-04T11:52:57-05:00', 'review', NULL),
  ('lead:l:2112760836345165', '560093', 'Abbiah Reddy Layout', 'new', NULL, NULL, '2026-07-04T14:09:23-05:00', 'review', NULL),
  ('lead:l:2471832399893967', '560025', 'Neelasandra', 'new', NULL, NULL, '2026-07-04T20:40:46-05:00', 'review', NULL),
  ('lead:l:1344160057074542', '560078', 'Bangalore jp nagar', 'converted', NULL, 'converted customer, essential grooming for 1300', '2026-07-04T21:47:55-05:00', 'medium', NULL),
  ('lead:l:2145575952665993', NULL, NULL, 'new', NULL, NULL, '2026-07-04T23:08:04-05:00', 'review', NULL),
  ('lead:l:1009183888530355', NULL, NULL, 'new', NULL, NULL, '2026-07-05T01:35:11-05:00', 'review', NULL),
  ('lead:l:1548983007015250', '560087', 'varthur', 'new', NULL, NULL, '2026-07-05T03:06:08-05:00', 'medium', NULL),
  ('lead:l:829130776803638', '560050', 'Banashankari', 'new', NULL, 'customer is ou lt of town will contact later', '2026-07-05T09:41:44-05:00', 'medium', NULL),
  ('lead:l:1333360035670402', NULL, NULL, 'new', NULL, NULL, '2026-07-05T09:52:04-05:00', 'review', NULL),
  ('lead:l:2543911929458246', '560058', 'Laggere 7996434302', 'new', NULL, NULL, '2026-07-05T11:39:56-05:00', 'medium', NULL),
  ('lead:l:2458253998006971', '560060', 'Ramasandra', 'new', NULL, NULL, '2026-07-05T21:12:26-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2232098757326370', NULL, NULL, 'new', NULL, 'custoker have booked for 999', '2026-07-06T08:51:10-05:00', 'review', NULL),
  ('lead:l:853485180884660', '560096', 'Nandani layout', 'new', NULL, NULL, '2026-07-06T09:52:45-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:4341050176149477', '560057', 'T dasarahalli', 'new', NULL, NULL, '2026-07-06T12:18:25-05:00', 'medium', NULL),
  ('lead:l:1043940601658126', '560011', 'Jayangar', 'new', NULL, NULL, '2026-07-06T14:05:57-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1649320149477216', '560004', 'ಬಸವನಗುಡಿ', 'new', NULL, NULL, '2026-07-06T21:16:47-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1822508668732712', '562107', 'Attibele', 'new', NULL, NULL, '2026-07-06T23:33:44-05:00', 'medium', NULL),
  ('lead:l:1062398246467759', '560070', 'DKB provision store and DKB water filter', 'new', NULL, NULL, '2026-07-07T06:05:04-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1338493655055170', '560078', 'Kumarswamylayot', 'new', NULL, NULL, '2026-07-07T08:23:31-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1713135799918862', NULL, NULL, 'new', NULL, 'No Follow-up', '2026-07-07T08:28:51-05:00', 'review', NULL),
  ('lead:l:2839515666421871', '560098', 'rr nagar', 'new', NULL, 'No Follow-up', '2026-07-08T01:46:24-05:00', 'medium', NULL),
  ('lead:l:1013906724764549', '560063', 'Yelahanka old town near masjid road', 'new', NULL, 'No message sent, forwarded the message', '2026-07-08T03:19:51-05:00', 'medium', NULL),
  ('lead:l:1728930508235893', '560068', 'Bengaluru kudlu gate michaels second cross', 'new', NULL, 'No message sent, forwarded the message', '2026-07-08T03:32:51-05:00', 'medium', NULL),
  ('lead:l:4027365470906167', '560026', 'Mysore Road satellite bus stop', 'new', NULL, 'No message sent, forwarded the message', '2026-07-08T04:33:17-05:00', 'medium', NULL),
  ('lead:l:2182372349003261', NULL, NULL, 'contacted', NULL, '1. Shihtzu, need only haircut, ask for a callback at 11 AM
2. Callback done, but DNP
3. DNP', '2026-07-08T10:57:40-05:00', 'review', NULL),
  ('lead:l:1752884965874735', '560099', 'Rayasandra', 'new', NULL, 'Cx ask details on wp, unable to speak on phone', '2026-07-08T12:52:42-05:00', 'medium', NULL),
  ('lead:l:776025922234855', '560087', 'Varthur', 'contacted', NULL, 'DNP, Forwarded a message
Call picked and ask to call at 11AM', '2026-07-09T23:21:08-05:00', 'medium', NULL);

INSERT INTO _sheet_updates (db_external_id, pincode, address, status_to_set, lost_reason, remarks, sheet_created_at, pincode_confidence, pincode_source) VALUES
  ('lead:l:958477653907936', '560078', 'Jpnagar', 'contacted', NULL, 'DNP, Forwarded a message
DNP', '2026-07-10T00:05:52-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1583524536730995', '560091', 'Sukudakatte heggnahalli cross Save Abhaya Anjaneya temple, No.16,1st floor,1st "F" cross, 8th main, road, near Hari Hara Petrol Bunk, Lakshman Nagar, Bengaluru, Karnataka 560091', 'contacted', NULL, 'DNP, Forwarded a message
Cx done grooming from Salon yesterday, at 799 (Haircut)', '2026-07-10T00:19:22-05:00', 'high', NULL),
  ('lead:l:1700305334608546', '560098', 'RR NAGAR', 'contacted', NULL, 'Talked with the customer, mentioned to send all ther detaiuls over whaatsapp. Waiting for an update.', '2026-07-10T03:26:17-05:00', 'medium', NULL),
  ('lead:l:1372392394869374', '560100', 'Electronic city phase 2', 'contacted', NULL, 'DNP, Forwarded a message
DNP', '2026-07-10T04:02:11-05:00', 'medium', NULL),
  ('lead:l:1428871165666660', '560064', 'Yelahanka', 'contacted', NULL, 'DNP, Forwarded a message
Asked for a callback after 1 hr', '2026-07-10T04:31:36-05:00', 'medium', NULL),
  ('lead:l:1501610454608036', '560064', 'Yelahanka', 'contacted', NULL, 'Disconnected the call. forwarded a message', '2026-07-10T05:32:02-05:00', 'medium', NULL),
  ('lead:l:1546792300317476', '560035', 'Kasavanahalli', 'contacted', NULL, 'call back after 10 am. Ho need update', '2026-07-10T07:13:30-05:00', 'medium', NULL),
  ('lead:l:27461791030150690', '560016', 'Tinfactory', 'contacted', NULL, 'DNP, Forwarded a message
DNP', '2026-07-10T07:20:57-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1769641574466805', NULL, NULL, 'contacted', NULL, 'DNP, Forwarded a message
Cx disconnects the call', '2026-07-10T10:27:43-05:00', 'review', NULL),
  ('lead:l:1425509932744275', '560091', 'Sunkadakatte', 'contacted', NULL, 'DNP, Forwarded a message', '2026-07-10T12:55:35-05:00', 'medium', NULL),
  ('lead:l:1279882014022445', '560051', 'Shivajinagar', 'contacted', NULL, 'Called the customer, mentioned she will be needing it for next week as she is out of town. She will be need a essential groomiing package. call back required by next week.', '2026-07-10T22:09:59-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:4007677679526330', '560049', '560049', 'new', NULL, 'DNP', '2026-07-11T03:42:35-05:00', 'high', NULL),
  ('lead:l:866710589847147', '560085', 'Bsk 3rd stage', 'new', NULL, 'DNP, not on WhatsApp', '2026-07-11T05:27:56-05:00', 'medium', NULL),
  ('lead:l:1381262260646700', NULL, NULL, 'new', NULL, 'DNP
Already booked at Salon 1099, today', '2026-07-11T06:57:23-05:00', 'review', NULL),
  ('lead:l:4470035366617332', NULL, NULL, 'converted', NULL, 'booked for 1599, tomorrow', '2026-07-11T07:44:16-05:00', 'review', NULL),
  ('lead:l:1857546185220802', '560100', 'Electronic City', 'new', NULL, 'DNP
Wrong Number (Hosur, Tamil Nadu)', '2026-07-11T13:17:32-05:00', 'medium', NULL),
  ('lead:l:1519609056315483', '560077', 'Thanisandra', 'new', NULL, 'DNP
Already booked at Salon for full grooming999 (offline booked)', '2026-07-11T19:09:25-05:00', 'medium', NULL),
  ('lead:l:1370284068379338', NULL, NULL, 'new', NULL, 'DNP
Already done grooming today.', '2026-07-11T22:47:16-05:00', 'review', NULL),
  ('lead:l:1035073756114758', NULL, NULL, 'converted', NULL, 'DNP 
Called cx, shihtzu she wants Bathing, Trim,, quoted 1599, she asked, she will call back tomorrow. booked', '2026-07-12T03:34:25-05:00', 'review', NULL),
  ('lead:l:1989653068346352', '560062', 'Konanakunte cross 560062', 'contacted', NULL, 'DNP, Forwarded a message', '2026-07-12T14:15:40-05:00', 'high', NULL),
  ('lead:l:1040771965010941', '560018', 'Chamarajpet', 'new', NULL, 'messaged on WhatsApp. waiting on response. Tried calling DNP', '2026-07-13T01:08:52-05:00', 'medium', NULL),
  ('lead:l:1330094322091498', NULL, NULL, 'new', NULL, 'Disconnected the call. Forwarded the message', '2026-07-13T02:44:22-05:00', 'review', NULL),
  ('lead:l:1351492886406029', '560064', 'Yelahanka new town', 'new', NULL, 'not nearby location . not on WhatsApp', '2026-07-14T01:07:19-05:00', 'medium', NULL),
  ('lead:l:1742195477227793', '560064', 'Doddabettahalli near attur layout', 'contacted', NULL, 'DNP. Forwarded a message', '2026-07-14T08:16:51-05:00', 'medium', NULL),
  ('lead:l:1507099600658229', '562149', 'Bagalur cross', 'new', NULL, 'waiting on response. no response till now', '2026-07-14T11:24:14-05:00', 'medium', NULL),
  ('lead:l:929317562902042', '560017', 'Lb Shastry nagar Hal post', 'contacted', NULL, 'DNP. forwarded a message', '2026-07-15T23:09:11-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1040306885052279', NULL, NULL, 'contacted', NULL, 'Customer disconnected the call. forwarded a message', '2026-07-15T23:58:18-05:00', 'review', NULL),
  ('lead:l:1803361237313579', '560036', 'Krishnarajapuram', 'new', NULL, 'DNP. NO WHATSAPP', '2026-07-16T07:00:13-05:00', 'medium', NULL),
  ('lead:l:993077630215465', '560077', 'K NARAYANAPURA', 'new', NULL, 'DNP. FORWARD MESSAGE', '2026-07-16T09:55:34-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1384781706859904', '560024', 'Hebbal', 'contacted', NULL, 'call back again not on WhatsApp', '2026-07-16T11:27:50-05:00', 'medium', NULL),
  ('lead:l:2460326554467156', '560030', 'Lakkasandra', 'new', NULL, 'DNP. FORWARD MESSAGE', '2026-07-16T13:02:33-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:877795018719789', '562149', 'Bagaluru cross', 'new', NULL, 'DNP. FORWARD MESSAGE', '2026-07-16T19:04:47-05:00', 'medium', NULL),
  ('lead:l:1423358906506954', '560068', 'Singasandara', 'converted', NULL, 'called and confirmed for 1500 for etential grooming for today 12 pm', '2026-07-17T00:39:14-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2084416328780023', '560087', 'Varthur', 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-17T06:25:30-05:00', 'medium', NULL),
  ('lead:l:2300154620811064', '560064', 'Yelahanka', 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-17T14:54:46-05:00', 'medium', NULL),
  ('lead:l:1699474741264623', '560051', 'Shivajinagar', 'contacted', NULL, 'Talked with cx, mentioned he is outside will text back. will be calling back.', '2026-07-17T21:50:27-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1541299557482276', '560096', 'Nandini layout', 'new', NULL, 'called no response. customer don''t have what app', '2026-07-18T00:57:15-05:00', 'medium', NULL),
  ('lead:l:1334763702064351', '562114', 'Hoskote', 'new', NULL, 'cx didn''t pick. message forwarded', '2026-07-18T07:23:47-05:00', 'medium', NULL),
  ('lead:l:27605777005739901', '560050', 'Banashankari', 'new', NULL, 'cx didn''t pick. message forwarded', '2026-07-18T23:09:40-05:00', 'medium', NULL),
  ('lead:l:27744962031799792', NULL, NULL, 'new', NULL, 'customer booked for Wednesday. will be sharing location', '2026-07-19T01:11:40-05:00', 'review', NULL),
  ('lead:l:2243732676373282', '560078', 'Jpnagar 5th phase', 'new', NULL, 'cx didn''t pick. not on WhatsApp', '2026-07-19T01:48:44-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1560096292456764', '560061', 'Uttrali', 'contacted', NULL, 'called cx no response, cx disconnected the call. forwarded a message', '2026-07-19T02:07:25-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1327755759441419', '560076', 'In jayadeva hospital near n s palya Bannerghatta road 560076', 'contacted', NULL, 'called cx no response, cx disconnected the call. forwarded a message', '2026-07-19T02:35:23-05:00', 'high', NULL),
  ('lead:l:1726476405359552', '560094', 'Bhadrapa layout', 'new', NULL, 'message forwarded. will be calling.', '2026-07-19T12:34:43-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1406041221429665', '560043', 'Hennur', 'new', NULL, 'message forwarded. will be calling.', '2026-07-19T13:23:31-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:25902871322744407', '560068', 'Madiwala', 'new', NULL, 'message forwarded. will be calling.', '2026-07-19T14:12:20-05:00', 'medium', NULL),
  ('lead:l:1620756643383362', '560003', 'Banglore Malleswaram 8th cross coconut Avenue road', 'new', NULL, 'DNP. NO WHATSAPP . incorrect number', '2026-07-20T00:01:09-05:00', 'medium', NULL),
  ('lead:l:1511709173502180', '560029', 'Tavarekere', 'contacted', NULL, 'DNP. FORWARDED A MESSAGE.', '2026-07-20T05:37:53-05:00', 'medium', NULL),
  ('lead:l:891309713526828', '560114', 'Begur koppa road, 2 dogs shihtzu one 3 yrs old amd 1 baby 3 months', 'contacted', NULL, 'DNP. FORWARDED A MESSAGE.', '2026-07-20T07:56:07-05:00', 'medium', NULL),
  ('lead:l:2001395840620667', NULL, NULL, 'contacted', NULL, 'DNP. FORWARDED A MESSAGE.', '2026-07-20T09:53:20-05:00', 'review', NULL),
  ('lead:l:1561110935677079', '560076', 'Btm', 'new', NULL, 'message forwarded. will be calling.', '2026-07-20T17:18:11-05:00', 'medium', NULL),
  ('lead:l:1726105814954349', '560010', 'Rajajinagar', 'new', NULL, 'DNP. not on WhatsApp', '2026-07-20T22:16:07-05:00', 'medium', NULL),
  ('lead:l:28089998710613372', '560008', 'Cambridge layout', 'contacted', NULL, 'Talked with cx. mentioned will get back to us on WhatsApp', '2026-07-20T22:55:17-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1029333346493081', '560087', 'Gunjur palya', 'contacted', NULL, 'DNP. FORWARDED a message', '2026-07-20T23:28:29-05:00', 'medium', NULL),
  ('lead:l:4591238207771626', '560048', 'Mahadevpura', 'contacted', NULL, 'DNP. FORWARDED a message', '2026-07-21T03:35:16-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:861999406765159', '560037', 'Marathahalli', 'contacted', NULL, 'DNP. FORWARDED a message', '2026-07-21T09:40:32-05:00', 'medium', NULL),
  ('lead:l:1555784115945593', '560036', 'KR Puram', 'new', NULL, 'Plz Call. Forworded the message. called , mentioned will be getting back to us', '2026-07-21T12:23:30-05:00', 'medium', NULL),
  ('lead:l:1583917409925683', '560064', 'Yelahanka agrahara layout', 'new', NULL, 'Plz Call. Forworded the message. called , mentioned will be getting back to us', '2026-07-21T14:26:19-05:00', 'medium', NULL),
  ('lead:l:2090641435184793', '560010', 'Rajajinagar', 'new', NULL, 'Plz Call. Forworded the message. DNP', '2026-07-21T16:58:07-05:00', 'medium', NULL),
  ('lead:l:2559546577816454', '560091', 'Herohalli', 'new', NULL, 'Plz Call. Forworded the message', '2026-07-21T20:21:34-05:00', 'medium', NULL),
  ('lead:l:1747525259593807', '560040', 'Vijaynagar Bangalore', 'new', NULL, 'Disconnected the call. FORWARDED message', '2026-07-22T00:39:20-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1681551789623613', '560076', 'Btm', 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-22T04:50:47-05:00', 'medium', NULL),
  ('lead:l:1066672232464595', '560114', 'Begur', 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-22T07:57:27-05:00', 'medium', NULL),
  ('lead:l:1057796826802131', '562149', 'Baglur', 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-22T08:25:53-05:00', 'medium', NULL),
  ('lead:l:27820202340909665', '562157', 'Chikkajala', 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-22T09:21:19-05:00', 'medium', NULL),
  ('lead:l:1358257579838572', '560015', 'BehindJindal prasthiti apartments', 'new', NULL, 'incorrect contact number', '2026-07-22T10:47:56-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1421822736446227', '560018', 'Chamrajpet', 'contacted', NULL, 'will call back. forwaded a message.', '2026-07-22T11:29:32-05:00', 'medium', NULL),
  ('lead:l:992731203789809', '560045', 'Nagawara 560045', 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-22T17:20:49-05:00', 'high', NULL),
  ('lead:l:1010924025119118', '587101', 'Bagewadi', 'new', NULL, 'DNP. FORWARDED MESSAGE . long distance', '2026-07-23T05:03:48-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1817491405907359', NULL, NULL, 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-23T10:44:28-05:00', 'review', NULL),
  ('lead:l:1067070872668423', NULL, NULL, 'new', NULL, 'DNP. FORWARDED MESSAGE', '2026-07-23T10:53:40-05:00', 'review', NULL),
  ('lead:l:1044232855233041', '560014', 'Jalahalli East', 'new', NULL, 'far distance DNP. FORWADED MESSAGE', '2026-07-23T15:05:59-05:00', 'medium', NULL),
  ('sheet:a787e3fb9e7566f5b6cbc7ed156244c4', '560100', 'electronic City 1', 'converted', NULL, 'booked for essential 1200', NULL, 'medium', NULL),
  ('lead:l:2166253193938662', '560035', 'Junnasadra road near by kidzz pre school', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-24T05:01:37-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:947215468378661', '560093', 'Kaggadasapura', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-24T10:28:38-05:00', 'medium', NULL),
  ('lead:l:1797900031175511', '560033', 'Jai Bharath nagar', 'converted', NULL, 'called the cx, mentioned will be calling back. booked for 900', '2026-07-24T23:28:36-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2096138744660565', '560054', 'Mathikere bangalore-54', 'contacted', NULL, 'talked with customer and cx mentioned for a call back', '2026-07-25T02:48:35-05:00', 'medium', NULL),
  ('lead:l:1080121881366427', '560022', 'Yeswanth pur', 'converted', NULL, 'wants a kannada associate . convert for 1000', '2026-07-25T07:31:57-05:00', 'medium', NULL),
  ('lead:l:1585506753148570', '560099', 'Chandapura', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-25T13:20:32-05:00', 'medium', NULL),
  ('lead:l:1047266511347555', NULL, NULL, 'new', NULL, 'DNP. FORWADED MESSAGE // wants kannada associate', '2026-07-25T13:30:45-05:00', 'review', NULL),
  ('lead:l:2847119472313238', '560072', 'Nagarbhavi', 'contacted', NULL, 'contacted cx mentioned to send the package on WhatsApp. Waiting for call back.', '2026-07-25T22:07:18-05:00', 'medium', NULL),
  ('lead:l:2517459778667375', '560066', 'Whitefield', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-25T23:03:05-05:00', 'medium', NULL),
  ('lead:l:1736911107455370', '560066', 'Whitefield', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-26T05:07:53-05:00', 'medium', NULL),
  ('lead:l:1909180349760632', '560036', 'Tc palya', 'new', NULL, 'DNP. mentioned will be calling back. forwaded a message.', '2026-07-27T03:06:50-05:00', 'medium', NULL),
  ('lead:l:1352862493667783', '560078', 'Jp nagar', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-27T04:39:17-05:00', 'medium', NULL),
  ('lead:l:1744157060056684', '560010', 'Rajajinagar', 'new', NULL, 'cx mentioned will be calling back, she was checking', '2026-07-27T05:39:58-05:00', 'medium', NULL),
  ('lead:l:1558221892646526', '560076', 'BTM layout 1st stage Tavarekere', 'new', NULL, 'cx mentioned will be calling back after 30 minutes . cx mentioned wanted a centre visit', '2026-07-27T08:39:03-05:00', 'medium', NULL),
  ('lead:l:1597019878604855', NULL, NULL, 'new', NULL, 'DNP. FORWADED A MESSAGE', '2026-07-27T10:40:21-05:00', 'review', NULL),
  ('lead:l:1196947742595016', '560076', 'Btm layout 1st stage', 'converted', NULL, 'booked for essential grooming 1200 on Sunday 10 am   /// called cx wants a essential grooming. told me to share the details call him back by Tommorow morning to confirm,', '2026-07-27T11:05:51-05:00', 'medium', NULL),
  ('lead:l:1789698482458832', '560102', 'Hsr', 'new', NULL, 'call got disconnected the cx mentioned she has network issue will be calling back', '2026-07-27T23:30:05-05:00', 'medium', NULL),
  ('lead:l:1861170635296570', NULL, NULL, 'converted', NULL, 'called disconnected by cx. message forwarded .
rescheduled, 1599,CC, 07/31 time 8:30', '2026-07-28T01:14:09-05:00', 'review', NULL),
  ('lead:l:1545885087080432', NULL, NULL, 'lost', 'Not interested', 'called the customer, customer mentioned as not interested for now. forwarded a message', '2026-07-28T07:00:36-05:00', 'review', NULL),
  ('lead:l:2079652689298155', '560064', 'Yelahanka', 'contacted', NULL, 'called the customer, disconnected the call. forwarded a message.', '2026-07-28T07:50:38-05:00', 'medium', NULL),
  ('lead:l:1061400179752018', '560038', 'Indiranagar', 'contacted', NULL, 'Talked with Cx, she mentioned she is interested but will confirming on Thursday for a Friday session with her friends dog as well.
Called cx, booked from a nearby salon.//', '2026-07-28T13:27:59-05:00', 'medium', NULL),
  ('lead:l:2084690242256120', '560025', 'Halasuru', 'new', NULL, 'Waiting for confirmation . confirmed for 1599
Called cx, DNP//', '2026-07-28T14:28:49-05:00', 'medium', NULL),
  ('lead:l:925028409848647', '560091', 'Muddinapalya', 'new', NULL, 'given the whatsapp number . will confirm on Thursday 
Called cx, booked from a nearby salon.//', '2026-07-28T16:29:21-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1025334303737067', '560084', 'Kammanahalli', 'new', NULL, 'DNP, tried again Busy. forwarded message
DNP//', '2026-07-29T04:24:24-05:00', 'medium', NULL),
  ('lead:l:1549541540006459', '560068', 'Madiwala', 'contacted', NULL, 'DNP. FORWARDED A MESSAGE', '2026-07-29T16:59:57-05:00', 'medium', NULL),
  ('lead:l:1058934906668992', '562114', 'Karapanahalli (v) Hoskote (TQ) bengaluru rural district', 'new', NULL, 'Confirm the location from cx, Karapanahalli is far away, cannot be serviceable.', '2026-07-30T06:28:15-05:00', 'medium', NULL),
  ('lead:l:1031319986159370', '560100', 'Electronic city phase 1', 'contacted', NULL, 'DNP. FORWARDED A MESSAGE // called again and the customer wanted essential grooming for 1000 rs and then disconnected when told we cannot drop below 1200.
Booked, 1000, EG, 7th Aug,', '2026-07-30T09:47:09-05:00', 'medium', NULL);

INSERT INTO _sheet_updates (db_external_id, pincode, address, status_to_set, lost_reason, remarks, sheet_created_at, pincode_confidence, pincode_source) VALUES
  ('lead:l:1043160718569139', '560102', 'Hsr', 'contacted', NULL, 'DNP. FORWARDED A MESSAGE// called again and she picked mentioned that she will be getting back to to us on WhatsApp as she was outside', '2026-07-30T12:49:31-05:00', 'medium', NULL),
  ('lead:l:27639002199127091', '560066', 'Whitefield', 'contacted', NULL, 'DNP. FORWARDED A MESSAGE // showed bg will be calling again.// customer called back to enquire and mentioned will give a call within 15 minutes. booked for 08/01 time 11:30. will be sharing the location and breed details as mentioned by the customer.
Called cx, cx going out of town and book an appointnment once he return after 2 days//', '2026-07-30T20:37:46-05:00', 'medium', NULL),
  ('lead:l:1230048869246637', NULL, NULL, 'new', NULL, 'did not wanted the service just checking as mentioned by cx', '2026-07-30T22:19:45-05:00', 'review', NULL),
  ('lead:l:1072243392036008', NULL, NULL, 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-31T01:34:23-05:00', 'review', NULL),
  ('lead:l:2168812533691769', '560066', 'Varthur/Whitefield', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-31T03:43:03-05:00', 'medium', NULL),
  ('lead:l:2433915007096104', '560066', 'Whitefield', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-07-31T04:16:32-05:00', 'medium', NULL),
  ('lead:l:1040846858542292', '560098', 'Channasandra', 'contacted', NULL, 'Talked with the CX, mentioned to send the package list, will be calling back.', '2026-07-31T04:37:45-05:00', 'medium', NULL),
  ('lead:l:1040617152077581', '560099', 'Rayasandra', 'contacted', NULL, 'called cx mentioned she is outside and to call back Tommorow to book the session', '2026-07-31T11:18:29-05:00', 'medium', NULL),
  ('lead:l:1087258660634561', NULL, NULL, 'new', NULL, 'cx wanted assami associate not able to understand Hindi or English. forwarded message', '2026-08-01T01:47:06-05:00', 'review', NULL),
  ('lead:l:1026052593748391', '560097', 'Vidyaranpura banglore 97', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-08-01T04:29:14-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:3575975019227127', '560098', 'Rajarajeshwarinagara', 'new', NULL, 'Called cx and mentioned he will be confirming on WhatsApp.', '2026-08-01T04:43:04-05:00', 'medium', NULL),
  ('lead:l:2071046213499782', '560035', 'Kasavanahalli, Sarjapur main road', 'converted', NULL, 'Called cx and mentioned he will be confirming on WhatsApp. //messeged back and confirmed for 08/02 time 12 pm for fur makeover in 1000', '2026-08-01T05:01:03-05:00', 'medium', NULL),
  ('lead:l:1313000497578931', NULL, NULL, 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-08-01T16:07:21-05:00', 'review', NULL),
  ('lead:l:1461109742709014', '560096', 'Nandini Layout', 'converted', NULL, 'mentioned he has booked through website for today', '2026-08-01T22:43:38-05:00', 'medium', NULL),
  ('lead:l:1782050469636183', NULL, NULL, 'new', NULL, 'Call Busy, msg forwarded// DNP. FORWADED MESSAGE', '2026-08-02T00:07:08-05:00', 'review', NULL),
  ('lead:l:2715877935517986', '560027', 'Shanthinagar', 'new', NULL, 'DNP. FORWADED MESSAGE // tried once again no response', '2026-08-02T10:50:15-05:00', 'medium', NULL),
  ('lead:l:3038100976534416', '560027', 'Sudham nagar', 'converted', NULL, 'DNP. FORWADED MESSAGE  // Cx mentioned to share the location and details of package and he will be confirming on WhatsApp for 08/04 time 10 am morning. forwarded message waiting for confirmation //.  confirmed for morning 10 am for complete care for a price 1600.', '2026-08-03T02:41:26-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1336861538618098', '560064', 'Yelahanka', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-08-03T02:42:53-05:00', 'medium', NULL),
  ('lead:l:1644981640970719', '560036', 'Kr Puram', 'converted', NULL, 'Talked with the customer, mentioned he wants essential grooming for two husky for 1200 each for 08/04 time 4 pm. will send the location on WhatsApp . shared the location', '2026-08-03T03:01:16-05:00', 'medium', NULL),
  ('lead:l:1364331175675450', '560100', 'Electronic City', 'new', NULL, 'cx has confirmed for the visit. waiting for the location', '2026-08-03T03:23:47-05:00', 'medium', NULL),
  ('lead:l:2222358091919977', '560062', 'Raghuvanahalli', 'new', NULL, 'forwarded message will be calling . // called the customer and Cx mentioned she will be getting back to us on WhatsApp.', '2026-08-03T10:40:46-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1372443381000675', NULL, NULL, 'new', NULL, 'forwarded message will be calling  // called the cx , cx mentioned he is calling from kollar as he got to know about us from some friends.', '2026-08-03T10:53:59-05:00', 'review', NULL),
  ('lead:l:1704008297573065', '560024', 'Hebbal', 'new', NULL, 'forwarded message will be calling // called him showed busy will calling back.', '2026-08-03T13:27:01-05:00', 'medium', NULL),
  ('lead:l:1416211487034072', '560066', 'Hopefarm Whitefield', 'new', NULL, 'forwarded message will be calling  // DNP WILL CALL AGAIN', '2026-08-03T16:13:00-05:00', 'medium', NULL),
  ('lead:l:1043286901800553', '560078', 'J P Nagar', 'new', NULL, 'called cx she was not good with Hindi or English wanted kannada associate', '2026-08-04T07:25:13-05:00', 'medium', NULL),
  ('lead:l:1051816823928795', '560078', 'JP NAGAR', 'converted', NULL, 'DNP. FORWADED MESSAGE // Cx reached us back on WhatsApp for confirmation and confirmed it for 1000 fur makeover for 08/05 time 1:30 pm.', '2026-08-04T08:16:47-05:00', 'medium', NULL),
  ('lead:l:1022821970380626', '560033', 'Jai barath nagar', 'new', NULL, 'DNP. FORWADED MESSAGE', '2026-08-04T08:48:48-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:3672966782866546', '560010', 'Rajajinagar Grooming', 'new', NULL, 'called cx, showed busy. forwarded message .//  customer called back and mentioned he wants it on Sunday and Will be confirming', '2026-08-04T08:59:25-05:00', 'medium', NULL),
  ('lead:l:4290567267925296', '560023', 'Magadi road', 'new', NULL, 'Forwarded the message, need to call tmrw// called the cx , he mentioned he will choosing hair cut for 1099 for today and he will sharing the details on WhatsApp, waiting for update', '2026-08-04T11:28:46-05:00', 'medium', NULL),
  ('lead:l:867507802904021', '560076', 'Shanthinikethan layout arekere', 'contacted', NULL, 'Forwarded the message, need to call tmrw// called the cx wants us to call back to confirm by today afternoon as mentioned.', '2026-08-04T11:38:49-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1332330955730535', '562110', 'Nagadevanahalli', 'converted', NULL, 'Forwarded the message, need to call tmrw// called and confirmed for today 08/05 time 4 pm. essential grooming for 1300. shitzu', '2026-08-04T13:17:36-05:00', 'medium', NULL),
  ('lead:l:1006935742335858', '560076', 'JP Nagar 9th phase', 'contacted', NULL, 'Forwarded a message, will call back. called the Cx , mentioned will be calling back after checking with family.', '2026-08-04T19:51:45-05:00', 'medium', NULL),
  ('lead:l:1777483533605277', '560005', 'frazer town', 'contacted', NULL, 'Talked with Cx, mentioned wants a visit on Saturday and will be sending the location and details Waiting for the details.', '2026-08-04T23:58:47-05:00', 'medium', NULL),
  ('lead:l:1746987276430328', '560099', 'Choodasandra Shyam interior studio Ganesha temple road', 'new', NULL, 'wanted a dog which is not our services right now', '2026-08-05T00:03:28-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1781873409663819', '560073', 'Indiranagar bangalore -560073', 'converted', NULL, 'Talked with Cx, waiting for details for location .
Booked, 1300, EG, 06/08/2026, 09 AM', '2026-08-05T00:48:54-05:00', 'high', NULL),
  ('lead:l:4714809225413676', NULL, NULL, 'new', NULL, 'wanted a dog which is not our services right now', '2026-08-05T02:22:04-05:00', 'review', NULL),
  ('lead:l:3198415887020251', '560102', 'Hsr layout', 'contacted', NULL, 'Called cx; need a callback; msg forwarded//Called cx but DNP', '2026-08-05T02:48:54-05:00', 'medium', NULL),
  ('lead:l:996849096737018', '560062', 'Avalahalli', 'contacted', NULL, 'Talked with Cx. mentioned that she will getting back to us on WhatsApp.', '2026-08-06T10:12:29-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2358993554924434', '560072', 'janapriya township', 'converted', NULL, 'DNP FORWARDED MESSAGE. cx called back and mentioned he will be sharing the details over whatsapp for Sunday // confirmed for Sunday 12 pm.', '2026-08-06T10:20:39-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1554140312626822', '560016', 'Rammurthy nagar bangalore', 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-06T10:23:42-05:00', 'medium', NULL),
  ('lead:l:28391717717080662', '562109', 'Bidadi 562109', 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-06T10:29:35-05:00', 'high', NULL),
  ('lead:l:1611716887160293', NULL, NULL, 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-06T11:45:13-05:00', 'review', NULL),
  ('lead:l:2325792424852693', '583101', 'Bellary', 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-06T22:25:54-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1054377917172608', '560066', 'Whitefield', 'converted', NULL, 'Talked with Cx, waiting for confirmation of location. the package is for fur bath. customer also needed Nail cut it is mentioned 1100.', '2026-08-07T01:29:09-05:00', 'medium', NULL),
  ('lead:l:1544334667491575', NULL, NULL, 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-07T02:10:02-05:00', 'review', NULL),
  ('lead:l:2049478432339775', NULL, NULL, 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-07T07:30:23-05:00', 'review', NULL),
  ('lead:l:1527988358546648', '560041', 'Jayanagar', 'contacted', NULL, 'DNP FORWARDED A MESSAGE . called the cx mentioned he wanted to buy a dog.', '2026-08-07T11:56:06-05:00', 'medium', NULL),
  ('lead:l:1390232249875049', NULL, NULL, 'new', NULL, 'waiting for confirmation.', '2026-08-07T12:23:31-05:00', 'review', NULL),
  ('lead:l:1354990646828556', '562110', 'Nagdevanahalli', 'new', NULL, 'already booked another groomer center as he wanted center visit', '2026-08-08T01:17:37-05:00', 'medium', NULL),
  ('lead:l:1368799058023111', NULL, NULL, 'contacted', NULL, 'DNP FORWARDED A MESSAGE', '2026-08-08T01:55:16-05:00', 'review', NULL),
  ('lead:l:2137101793905666', '560049', 'Medahalli', 'contacted', NULL, 'DNP FORWARDED A MESSAGE', '2026-08-08T02:24:38-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1073122008387465', '575001', 'In mangalore .', 'new', NULL, 'it is mangalore not possible for groomer visit', '2026-08-08T02:29:02-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1073337062300343', '560068', 'Kudlu village', 'converted', NULL, 'Cx wants it on next Sunday. and mentioned he will the share the location details // shared the details and opted for essential grooming for 1200 for coming Sunday', '2026-08-08T03:31:49-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1375947724671970', '560005', 'Jeevanhalli', 'contacted', NULL, 'DNP FORWARDED A MESSAGE', '2026-08-08T10:42:36-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:928045729632811', '560100', 'Hosa road basapura', 'new', NULL, 'Talking with Cx waiting for confirmation.', '2026-08-08T23:35:09-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1032144686336659', '560064', 'Yelahanka', 'contacted', NULL, 'DNP FORWARDED A MESSAGE', '2026-08-09T01:27:22-05:00', 'medium', NULL),
  ('lead:l:1056307923460130', '560064', 'Yelahanka', 'contacted', NULL, 'DNP FORWARDED A MESSAGE', '2026-08-09T03:06:19-05:00', 'medium', NULL),
  ('lead:l:1057794016632424', '560102', 'HSR teachers colony', 'contacted', NULL, 'DNP FORWARDED A MESSAGE', '2026-08-09T06:33:43-05:00', 'medium', NULL),
  ('lead:l:1739221024062208', '560088', 'Bengaluru hessghatta', 'converted', NULL, 'Talked with Cx, waiting for confirmation . // customer wants only haircut and bathing for 1400 for 08/10 time 12 pm.', '2026-08-09T11:43:55-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1466351725512650', '560064', 'Yelahanka Agrahara', 'new', NULL, 'distance is long and we do not have groomer for that location', '2026-08-10T03:26:29-05:00', 'medium', NULL),
  ('lead:l:1705096324117924', '560026', 'Mysore Road', 'new', NULL, 'distance is long and we do not have groomer for that location', '2026-08-10T07:00:09-05:00', 'medium', NULL),
  ('lead:l:2128936611838238', '570001', 'In Mysore near Mpro', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-10T10:19:01-05:00', 'medium', NULL),
  ('lead:l:2002696883765718', '560057', 'Peenya', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-10T10:50:57-05:00', 'medium', NULL),
  ('lead:l:1707532800364896', '560057', '2nd Stage Peenya', 'new', NULL, 'looking for dog to buy.', '2026-08-10T20:49:11-05:00', 'medium', NULL),
  ('lead:l:1975450129781134', '560036', 'Tc paly', 'contacted', NULL, 'was showing busy forwarded a message.', '2026-08-10T20:58:52-05:00', 'medium', NULL),
  ('lead:l:2588872558251223', NULL, NULL, 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-11T10:40:24-05:00', 'review', NULL),
  ('lead:l:1062855692798009', '560114', 'Begur-560114', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-11T11:20:20-05:00', 'high', NULL),
  ('lead:l:27786021831090315', '560078', 'Jp nagar', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-12T16:42:27-05:00', 'medium', NULL),
  ('lead:l:1230868169183061', NULL, NULL, 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-12T20:07:01-05:00', 'review', NULL),
  ('lead:l:1086296767681919', '560036', 'Krpura', 'contacted', NULL, 'Talked with Cx for 7 shitzu dogs only hair cut . Cx mentioned they will be confirming over whatsapp as they are living for office.', '2026-08-12T20:23:43-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1418548780425045', '560037', 'Marathahalli', 'new', NULL, 'The number is incorrect as mentioned over calling the customer.', '2026-08-12T21:56:49-05:00', 'medium', NULL),
  ('lead:l:1413099144248249', '560098', 'R r Nagar', 'new', NULL, 'The mentioned she will cheing the package and getting back to us on WhatsApp. waiting for confirmation.', '2026-08-13T01:05:25-05:00', 'medium', NULL),
  ('lead:l:1686731055748273', NULL, NULL, 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-13T03:53:35-05:00', 'review', NULL),
  ('lead:l:1998453860807605', NULL, NULL, 'new', NULL, 'DNP, not on WhatsApp', '2026-08-13T04:50:46-05:00', 'review', NULL),
  ('lead:l:2017263488943797', '560053', 'Akkipet', 'new', NULL, 'customer wanted bath and hair cut for 900, which could not provide lower then 1200', '2026-08-13T08:09:05-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1696775241403738', '560034', 'Kormangala', 'new', NULL, 'Called th Cx, mentioned to share the details for haircut and bathing over whatsapp and she will let us know about the confirmation', '2026-08-13T08:53:49-05:00', 'medium', NULL),
  ('lead:l:940840988311067', '562114', 'Hoskote', 'converted', NULL, 'Called CX she mentioned we are loking for tomorrow but will confirm with husband and get bck.
Scheduled, 900*2=1800, FM, 15th August, 11 AM,2 Persian', '2026-08-13T11:12:56-05:00', 'medium', NULL),
  ('lead:l:1052310310780456', '560100', 'Chinnu', 'new', NULL, 'it is in maysore city not serviceable', '2026-08-14T02:15:11-05:00', 'approximate', 'remark/locality inference'),
  ('lead:l:1840010793648232', NULL, NULL, 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-14T06:20:35-05:00', 'review', NULL),
  ('lead:l:1062648826317436', '573201', 'No hassan', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-14T07:48:16-05:00', 'medium', NULL),
  ('lead:l:1051889863864317', '560038', 'Indiranagar', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-14T12:02:29-05:00', 'medium', NULL),
  ('lead:l:4713005488985967', NULL, NULL, 'contacted', NULL, 'Talked with CX she has 4 month shitzu, want hair cut and dry bath. Will be calling back for confirmation for today near Bannerghatta', '2026-08-14T12:17:01-05:00', 'review', NULL),
  ('lead:l:1369719355264003', '560084', 'Kammanahalli', 'contacted', NULL, 'Disconnected the call . Forwarded a message', '2026-08-14T12:57:36-05:00', 'medium', NULL),
  ('lead:l:1073531891732511', NULL, NULL, 'new', NULL, 'number not in service', '2026-08-14T13:25:02-05:00', 'review', NULL),
  ('lead:l:3053209408217914', '560098', 'Rajarajeshwari Nagar', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-15T01:01:34-05:00', 'medium', NULL),
  ('lead:l:1461349249354383', NULL, NULL, 'contacted', NULL, 'Talked with CX she was outside, mentioned she will be calling back.', '2026-08-15T02:07:30-05:00', 'review', NULL),
  ('lead:l:1955732328382674', '560057', 'Dasarahalli', 'contacted', NULL, 'Showed Busy, forwarded a message', '2026-08-15T02:36:35-05:00', 'medium', NULL),
  ('lead:l:1437357344906033', '560048', 'Mahadevpura', 'contacted', NULL, 'Talked with Cx, mentioned she will ping the details over whatsapp. for two shitzu only haircut and nail trimming for 900.', '2026-08-15T08:01:41-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2063640347577261', NULL, NULL, 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-15T15:42:18-05:00', 'review', NULL),
  ('lead:l:833176179787581', '560037', 'Marathahalli', 'new', NULL, 'Talking over whatsapp. waiting for confirmation.', '2026-08-15T22:53:29-05:00', 'medium', NULL),
  ('lead:l:866511503082156', '560062', 'Konankunte cross', 'contacted', NULL, 'Talked with Cx waiting for details', '2026-08-16T03:52:44-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1588043536041915', '560086', 'Mahalakshmi Layout', 'contacted', NULL, 'Talked with Cx waiting for details', '2026-08-16T04:15:22-05:00', 'medium', NULL),
  ('lead:l:1599214308447528', '560083', 'Bannerghatta', 'contacted', NULL, 'number showed switched off . forwarded a message.', '2026-08-16T21:26:57-05:00', 'medium', NULL),
  ('lead:l:1575294327304004', '560050', 'Srinagar Banashankari', 'converted', NULL, 'DNP FORWARDED MESSAGE. //Cx called back to check on the package and mentioned he will be calling back for confirmation. // shitzu, essential grooming, Wednesday, 19/08 time 9 am. 1200', '2026-08-16T21:47:33-05:00', 'medium', NULL),
  ('lead:l:1631261595052910', '560036', 'Margondanahalli', 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-16T21:50:12-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2086631481927557', '560090', 'Abbigire', 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-16T23:38:03-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1357923119821556', '560084', 'Lingrajpuram', 'contacted', NULL, 'Showed busy, forwarded a message . // called back checked with the package. will be calling back.', '2026-08-17T02:38:06-05:00', 'medium', NULL),
  ('lead:l:1581260936812918', NULL, NULL, 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-17T03:05:28-05:00', 'review', NULL),
  ('lead:l:1669342044143756', '560076', 'Arekere', 'new', NULL, 'Cx mentioned he is office and Will be calling or texting back .', '2026-08-17T05:18:35-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1093521936444818', '560057', 'Avilana public school rathnaraj nilaya 3rd floor 42 vijayalakshmi layout mallsandra extension shetty halli jalhalli west benglore 560057', 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-17T09:21:52-05:00', 'high', NULL);

INSERT INTO _sheet_updates (db_external_id, pincode, address, status_to_set, lost_reason, remarks, sheet_created_at, pincode_confidence, pincode_source) VALUES
  ('lead:l:1060507389960252', '560088', 'Hessarghatta', 'converted', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-17T21:23:46-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1040787948595792', '580020', 'Hubli', 'new', NULL, 'Not serviceable as Cx mentioned it is in hubbli', '2026-08-18T03:11:41-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1227764200424348', '560018', 'Chamrajpet', 'contacted', NULL, 'Talked with Cx waiting for details', '2026-08-18T07:25:20-05:00', 'medium', NULL),
  ('lead:l:1060627316714567', NULL, NULL, 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-18T07:47:53-05:00', 'review', NULL),
  ('lead:l:1732758314604153', '560088', 'Hesaragatta', 'new', NULL, 'called the Cx and she mentioned will be calling back.', '2026-08-18T20:46:29-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1371721664425789', NULL, NULL, 'new', NULL, 'the cx wants it for maysore which is not serviceable', '2026-08-18T21:06:28-05:00', 'review', NULL),
  ('lead:l:2230949321086302', NULL, NULL, 'new', NULL, 'DNP, Msg Forwarded', '2026-08-19T02:21:29-05:00', 'review', NULL),
  ('lead:l:913610464642976', '560064', 'Yelahanka', 'new', NULL, 'DNP, Msg Forwarded', '2026-08-19T03:19:20-05:00', 'medium', NULL),
  ('lead:l:1066444205834865', '560072', '32/,28, 3rd cross Gangamma garden,malgala,nagarbhavi 2nd stage, banglore', 'new', NULL, 'did it from other company because of the package was less', '2026-08-19T06:34:04-05:00', 'medium', NULL),
  ('lead:l:2197885824119487', NULL, NULL, 'new', NULL, 'switched off. forwarded message', '2026-08-19T13:50:46-05:00', 'review', NULL),
  ('lead:l:1740743103840649', '563101', 'Kolar', 'new', NULL, 'DNP, Msg Forwarded', '2026-08-19T22:13:10-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2464000537437761', NULL, NULL, 'contacted', NULL, 'Talked to cx waiting for confirmation.', '2026-08-19T22:39:56-05:00', 'review', NULL),
  ('lead:l:1070366999015248', NULL, NULL, 'new', NULL, 'DNP, not on WhatsApp', '2026-08-20T01:48:32-05:00', 'review', NULL),
  ('lead:l:2360192831390070', '560066', 'Whitefield', 'contacted', NULL, 'Talked with the cx, waiting for the confirmation.', '2026-08-20T04:31:05-05:00', 'medium', NULL),
  ('lead:l:1731280481458354', NULL, NULL, 'contacted', NULL, 'Talked with the cx, wnated a kannada associate. Forwarded to dev.', '2026-08-20T06:10:30-05:00', 'review', NULL),
  ('lead:l:1566223471674996', '560060', 'Kengeri', 'converted', NULL, 'Called the cx , showed busy. Forwarded an message.esseential grooming, shitzu, Saturday, 1500, 22/08', '2026-08-20T06:23:52-05:00', 'medium', NULL),
  ('lead:l:2359775581096594', '560066', 'Whitefield', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-20T08:33:12-05:00', 'medium', NULL),
  ('lead:l:2166118244321204', NULL, NULL, 'converted', NULL, 'called the cx, confirm for 12:30 pm, 21/08, essential grooming, 1200, beagle', '2026-08-20T12:06:28-05:00', 'review', NULL),
  ('lead:l:1062780976231419', '560100', 'Electronic City', 'converted', NULL, 'talked with customer, he will be calling back. customer confirmed for indie, 1600, complete care, 21/08 2:30 pm.', '2026-08-20T23:41:50-05:00', 'medium', NULL),
  ('lead:l:2025913168041590', '560043', 'Hennur', 'contacted', NULL, 'DNP FORWARDED A MESSAGE.', '2026-08-21T08:02:26-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:886135580996692', NULL, NULL, 'new', NULL, 'the person said i have never applied for grooming.', '2026-08-21T10:45:11-05:00', 'review', NULL),
  ('lead:l:1546863673593092', '590001', 'Belgavi', 'contacted', NULL, 'switched off, forwarded a message', '2026-08-21T11:54:01-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:4421309078141870', '560085', '560085', 'contacted', NULL, 'Talked with Cx, mentioned that he needs the complete care for 1100 but I mentioned we can not go below 1600 with employee discount as well. he mentioned he will be calling back.', '2026-08-21T13:39:27-05:00', 'high', NULL),
  ('lead:l:1415260207171977', '560076', 'Btm', 'new', NULL, 'cx was in meeting and mentioned she will be calling back.', '2026-08-21T15:14:05-05:00', 'medium', NULL),
  ('lead:l:1772932737287258', '561203', 'Rajankunte', 'contacted', NULL, 'switched off, forwarded a message // talked with cx mentioned Will be confirming on WhatsApp', '2026-08-22T10:29:56-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1531663821621239', NULL, NULL, 'new', NULL, 'Do not want booking', '2026-08-22T10:32:58-05:00', 'review', NULL),
  ('lead:l:1022977940499849', NULL, NULL, 'new', NULL, 'DNP', '2026-08-22T14:29:12-05:00', 'review', NULL),
  ('lead:l:1981881929286802', '560068', 'Akshayanagar', 'contacted', NULL, 'Talked with Cx, will be calling back.', '2026-08-22T14:38:04-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1647083493731769', '562109', 'Bidadi', 'new', NULL, 'wants kannada associate', '2026-08-22T21:28:45-05:00', 'medium', NULL),
  ('lead:l:1376492223940124', '560037', 'Brookefield', 'new', NULL, 'wanted to know about the package', '2026-08-22T22:59:00-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2160530114504993', '560032', 'Rt nagar, hebbal', 'new', NULL, 'incorrect number', '2026-08-23T03:42:01-05:00', 'medium', NULL),
  ('lead:l:2270723413694578', '560068', 'Singasandra', 'contacted', NULL, 'Talked with Cx, mentioned to ping him and he will notify when he wants the visit', '2026-08-23T04:00:04-05:00', 'medium', NULL),
  ('lead:l:1348370943695882', '560062', 'Konankunte', 'new', NULL, 'They have taken the service from another vendor', '2026-08-23T04:22:38-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1588493426258895', '560029', 'Bismillah Nagar', 'contacted', NULL, 'unreachable, forwarded a message', '2026-08-23T05:27:15-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1084258501223676', '560047', 'Jayraj Nagar', 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-23T08:35:47-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1436076378573712', '560041', 'Srk garden jayanagar Tilak Nagar', 'new', NULL, 'DNP FORWARDED MESSAGE.', '2026-08-23T10:02:37-05:00', 'medium', NULL),
  ('lead:l:1415841517130863', NULL, NULL, 'new', NULL, 'wants kannada associate.', '2026-08-23T23:09:38-05:00', 'review', NULL),
  ('lead:l:27522991100716177', '560043', 'Banaswadi', 'new', NULL, 'Called the cx, she mentioned that she is outside will be calling back.', '2026-08-23T23:55:40-05:00', 'medium', NULL),
  ('lead:l:2106079173367675', '560036', 'KR Puram', 'new', NULL, 'cx mentioned he will be calling back', '2026-08-24T02:07:14-05:00', 'medium', NULL),
  ('lead:l:2067961813859868', NULL, NULL, 'new', NULL, 'cx mentioned he will be calling back', '2026-08-24T02:22:43-05:00', 'review', NULL),
  ('lead:l:909009532284494', '561203', 'DODDA ALLAPUR', 'new', NULL, 'DNP', '2026-08-25T03:55:20-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:28389927793963549', '562107', 'Attibele', 'contacted', NULL, 'talked with Cx, forwarded message. waiting for confirmation', '2026-08-25T23:47:52-05:00', 'medium', NULL),
  ('lead:l:1283265943783926', NULL, NULL, 'contacted', NULL, 'talked with Cx waiting for confirmation.', '2026-08-26T01:12:49-05:00', 'review', NULL),
  ('lead:l:827275057077868', '562130', 'Chinnagenahalli', 'new', NULL, 'already booked from another vendor', '2026-08-26T01:46:30-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1574672090733289', '560090', 'Soldevnahalli', 'converted', NULL, 'showed busy forwarded message// Persian 7 months Old, Pitched EG, Need on 28/08/2026
Converted, 1299, EG, 28th August, 11 AM', '2026-08-26T04:59:54-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1549965980214998', '560072', 'Nagarbhavi', 'new', NULL, 'DNP
DNP', '2026-08-26T06:11:17-05:00', 'medium', NULL),
  ('lead:l:2002136043832410', '560078', 'Jp nagar', 'new', NULL, 'Message forwarded//DNP//DNP', '2026-08-26T08:15:28-05:00', 'medium', NULL),
  ('lead:l:1559054895763334', '562114', 'Hoskote', 'new', NULL, 'Message forwarded//kannada associate hand over to Dev Bhaiya', '2026-08-26T13:49:39-05:00', 'medium', NULL),
  ('lead:l:1550265239725948', '560027', 'Shanti nagar najjappa circle banglore-27', 'new', NULL, 'Message Forwarded//DNP//Cx disconnects the call, Seems to only knows Kannada hand over to Dev Bhaiya', '2026-08-26T16:06:47-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1424083722932680', '560060', 'Kaniminke', 'new', NULL, 'Message Forwarded// Cx disconnect the call', '2026-08-26T22:39:39-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1045622491418326', '573201', 'Hassan', 'new', NULL, 'Message Forwarded//kannada associate hand over to Dev Bhaiya', '2026-08-27T05:35:14-05:00', 'medium', NULL),
  ('lead:l:1826865705335595', NULL, NULL, 'converted', NULL, 'Message Forwarded//ShihTzu, 7 months Old, Used to groom with Vetic, but seek convenience, so they want Doorstep grooming services.
Converted, 1499, CC, 27th August, 3:30 PM', '2026-08-27T05:37:42-05:00', 'review', NULL),
  ('lead:l:1096362039397285', '560043', '560043', 'contacted', NULL, 'Call busy, msg forwarded// 
Pitched Fur Makeover for 999 each pet. Cx has 6 shihtzu// Cx ask to give a callback', '2026-08-27T08:39:15-05:00', 'high', NULL),
  ('lead:l:2307590226678211', '560038', 'Indranagar', 'new', NULL, 'msg forwarded// dnp', '2026-08-27T13:42:05-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2125398825051860', '560061', 'Uttarahalli', 'contacted', NULL, 'Talked with the customer, customer wanted fur makeover under 499. denied for 900 .', '2026-08-28T06:45:26-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2186046868935239', NULL, NULL, 'new', NULL, 'DNP', '2026-08-28T09:01:48-05:00', 'review', NULL),
  ('lead:l:1623839702409204', '561203', 'Doddaballpur', 'new', NULL, 'DNP', '2026-08-28T10:16:39-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:4310295109284671', '560026', 'New kavika layout bapuji Nagar Bangalore', 'contacted', NULL, 'CALL CX, MENTIONED WILL CALL BACK.', '2026-08-28T11:17:06-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1728410081764608', '562130', 'Near dodadaldmara', 'contacted', NULL, 'disconnected the call, forwarded a message', '2026-08-28T11:19:41-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1982513362395143', NULL, NULL, 'new', NULL, 'waiting for confirmation', '2026-08-28T20:19:11-05:00', 'review', NULL),
  ('lead:l:4092450887556210', NULL, NULL, 'new', NULL, 'waiting for confirmation', '2026-08-28T22:39:43-05:00', 'review', NULL),
  ('lead:l:28456817927267805', NULL, NULL, 'new', NULL, 'DNP', '2026-08-29T01:43:56-05:00', 'review', NULL),
  ('lead:l:1224717216485869', '560076', 'Omkar Nagar Arakere BG road', 'new', NULL, 'DNP', '2026-08-29T04:16:31-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1431943692135387', '560061', 'Vasantha pura Subramanya pura posed Bangalore 560061', 'new', NULL, 'waiting for confirmation for today // will be calling back', '2026-08-29T07:21:41-05:00', 'high', NULL),
  ('lead:l:1530948222047777', '560076', 'Btm', 'new', NULL, 'DNP', '2026-08-29T08:22:41-05:00', 'medium', NULL),
  ('lead:l:4923045867929685', '560057', 'Near sapthagiri college of engineering hesarghatta main road', 'new', NULL, 'DNP', '2026-08-29T10:36:35-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1606686987791043', '560066', 'Whitefield', 'new', NULL, 'cx wanted the complete care services in 900. which is not possible to be served.', '2026-08-29T21:37:27-05:00', 'medium', NULL),
  ('lead:l:28041933175460789', NULL, NULL, 'new', NULL, 'DNP', '2026-08-29T23:55:20-05:00', 'review', NULL),
  ('lead:l:1388219580143713', '560018', 'Chamrajpet', 'contacted', NULL, 'cx mentioned he will be calling back//Pitch Essential Groming for 1599; asked location, cx need to check with his wife, need a callback // cx mentioned he has taken the service from another vendor.', '2026-08-30T00:15:46-05:00', 'medium', NULL),
  ('lead:l:1852251672473989', '560032', 'Rt nagar', 'new', NULL, 'cx will be calling back//dnp', '2026-08-30T00:35:17-05:00', 'medium', NULL),
  ('lead:l:1374296120998475', '560085', 'Kathriguppe', 'new', NULL, 'Msg forwarded// not reachable', '2026-08-30T01:07:24-05:00', 'medium', NULL),
  ('lead:l:3663411517159477', NULL, NULL, 'new', NULL, 'msg forwarded// dnp', '2026-08-30T02:47:50-05:00', 'review', NULL),
  ('lead:l:1367890475461252', '560003', 'Malleshwram', 'new', NULL, 'Dnp', '2026-08-30T03:56:14-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1735167501033861', '560076', 'Btm 2stage', 'new', NULL, 'she does not want now, she was checking the details. but once her dog is back in Bangalore she will be calling back.', '2026-08-30T05:16:38-05:00', 'medium', NULL),
  ('lead:l:2384154285328206', '572101', 'Tumkur', 'new', NULL, 'wants a kannada associate.forwarded to dev', '2026-08-30T11:38:13-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2905637283120875', '560032', 'Kankanagar(rt nagar)', 'contacted', NULL, 'Talked with Cx waiting for confirmation.', '2026-08-30T21:40:40-05:00', 'medium', NULL),
  ('lead:l:1616141496925498', '560074', 'Anche palya', 'new', NULL, 'wants a kannada associate.forwarded to dev', '2026-08-30T22:18:29-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1794188268593419', '560100', 'E city', 'contacted', NULL, 'Talked with Cx, confirm for the haircut and nail cut for Saturday, waiting for location. booking for 1300 Persian cat. // still not answering will be calling back', '2026-08-31T14:57:10-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1109738078380279', '560047', 'Austin town', 'contacted', NULL, 'Talked with Cx, mentioned he will be calling back after 12 pm', '2026-08-31T19:38:24-05:00', 'medium', NULL),
  ('lead:l:947865667698582', '560009', 'Majestic', 'contacted', NULL, 'Disconnected the call, forwarded a message.', '2026-08-31T23:42:33-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:2258942718203647', '560076', 'Btm stage 1st', 'new', NULL, 'DNP', '2026-09-01T02:23:47-05:00', 'medium', NULL),
  ('lead:l:2266451874154245', '560057', 'Peenya', 'new', NULL, 'no response disconnected the call.', '2026-09-01T05:27:11-05:00', 'medium', NULL),
  ('lead:l:1086744620591795', '560043', 'Kasthuri nagar', 'new', NULL, 'Disconnected the call // DNP', '2026-09-01T10:17:21-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1385290300398720', '560102', 'Haralur Road', 'new', NULL, 'customer mentioned she is only looking for face hair cut under 400.', '2026-09-01T13:32:30-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:3496507770514010', '562114', 'Jadigenahalli hoskote talukku malur rod 562114', 'new', NULL, 'wanted kannada and disconnected the call, forwarded to dev', '2026-09-01T23:25:18-05:00', 'high', NULL),
  ('lead:l:1084447664105422', '584101', 'Raichur district', 'new', NULL, 'wanted kannada and disconnected the call, forwarded to dev', '2026-09-02T00:28:19-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1054701144123079', NULL, 'Nandini layout', 'new', NULL, 'wanted kannada and disconnected the call, forwarded to dev', '2026-09-02T00:32:52-05:00', 'medium', NULL),
  ('lead:l:1546154970082466', '560005', 'Frzaer town', 'new', NULL, 'DNP//msg forwarded', '2026-09-02T05:29:48-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1799445684559533', '560070', 'Bsk 2nd stage', 'new', NULL, 'DNP//msg forwarded', '2026-09-02T07:02:33-05:00', 'approximate', 'locality / nearby postal-area inference'),
  ('lead:l:1016173204799459', '560084', 'Lingrajpuram', 'new', NULL, 'DNP // Talking with Cx. waiting for confirmation', '2026-09-02T09:37:04-05:00', 'medium', NULL);

-- Resolve staging rows to leads that are CURRENTLY 'new' (run-time guard —
-- if the pipeline moved on since generation, those leads are skipped here).
DROP TABLE IF EXISTS _matched;
CREATE TEMP TABLE _matched AS
SELECT s.*,
       l.id       AS lead_id,
       l.user_id  AS user_id,
       l.pincode  AS db_pincode,      -- pre-update snapshot for the activity log
       l.address  AS db_address
FROM _sheet_updates s
JOIN crm_leads l ON l.external_lead_id = s.db_external_id
WHERE l.status = 'new';

-- Earliest platform booking per converted lead (same customer, created
-- on/after the historical lead date — the ownership rule the service enforces).
DROP TABLE IF EXISTS _converted_bookings;
CREATE TEMP TABLE _converted_bookings AS
SELECT DISTINCT ON (m.lead_id) m.lead_id, b.id AS booking_id
FROM _matched m
JOIN bookings b ON b.user_id = m.user_id AND b.created_at >= m.sheet_created_at
WHERE m.status_to_set = 'converted'
ORDER BY m.lead_id, b.created_at ASC;

-- ─── 2) Update the leads (fills only where missing; status per the sheet) ───
UPDATE crm_leads l
SET
  pincode              = COALESCE(l.pincode, m.pincode),
  address              = COALESCE(l.address, m.address),
  status               = CASE WHEN m.status_to_set <> 'new' THEN m.status_to_set::crm_lead_status ELSE l.status END,
  first_contacted_at   = CASE WHEN m.status_to_set IN ('contacted', 'interested', 'follow_up')
                                 AND l.first_contacted_at IS NULL
                               THEN now() ELSE l.first_contacted_at END,
  lost_reason          = CASE WHEN m.status_to_set = 'lost' THEN m.lost_reason ELSE l.lost_reason END,
  next_followup_at     = CASE WHEN m.status_to_set IN ('lost', 'cancelled', 'converted')
                               THEN NULL ELSE l.next_followup_at END,
  converted_booking_id = CASE WHEN m.status_to_set = 'converted' THEN cb.booking_id ELSE l.converted_booking_id END,
  last_activity_at     = now()
FROM _matched m
LEFT JOIN _converted_bookings cb ON cb.lead_id = m.lead_id
WHERE l.id = m.lead_id
  AND (
       (l.pincode IS NULL AND m.pincode IS NOT NULL)   -- pincode fill
    OR (l.address IS NULL AND m.address IS NOT NULL)   -- address fill
    OR m.status_to_set <> 'new'                        -- status transition
    OR (m.remarks IS NOT NULL AND m.remarks <> ''      -- new remark note
        AND NOT EXISTS (SELECT 1 FROM crm_lead_activities a
                        WHERE a.lead_id = l.id
                          AND a.activity_type = 'note'
                          AND a.body = m.remarks))
  );

-- ─── 3) Activity log (exactly what the app service writes) ───

-- 3a) location_updated — pincode/address fills (pre-update state from _matched)
INSERT INTO crm_lead_activities (lead_id, actor_id, activity_type, body, metadata)
SELECT m.lead_id, NULL, 'location_updated'::crm_lead_activity_type,
       'Lead location updated: '
         || concat_ws(', ',
              CASE WHEN m.db_pincode IS NULL AND m.pincode IS NOT NULL THEN 'pincode → ' || m.pincode END,
              CASE WHEN m.db_address IS NULL AND m.address IS NOT NULL THEN 'address → ' || m.address END)
         || '.',
       jsonb_build_object(
         'backfill', 'historical_sheet',
         'external_lead_id', m.db_external_id,
         'pincode_confidence', m.pincode_confidence,
         'pincode_source', m.pincode_source)
FROM _matched m
WHERE (m.db_pincode IS NULL AND m.pincode IS NOT NULL)
   OR (m.db_address IS NULL AND m.address IS NOT NULL);

-- 3b) lost — with the mapped reason
INSERT INTO crm_lead_activities (lead_id, actor_id, activity_type, body, metadata)
SELECT m.lead_id, NULL, 'lost'::crm_lead_activity_type,
       'Lead lost: ' || m.lost_reason,
       jsonb_build_object('backfill', 'historical_sheet', 'lost_reason', m.lost_reason)
FROM _matched m
WHERE m.status_to_set = 'lost';

-- 3c) converted — booking-linked when possible, otherwise flagged
INSERT INTO crm_lead_activities (lead_id, actor_id, activity_type, body, metadata)
SELECT m.lead_id, NULL, 'converted'::crm_lead_activity_type,
       COALESCE('Lead converted to booking #' || cb.booking_id || '.',
                'Lead converted (historical sheet backfill; no platform booking found to link).'),
       jsonb_build_object('backfill', 'historical_sheet', 'booking_id', cb.booking_id)
FROM _matched m
LEFT JOIN _converted_bookings cb ON cb.lead_id = m.lead_id
WHERE m.status_to_set = 'converted';

-- 3d) status_change
INSERT INTO crm_lead_activities (lead_id, actor_id, activity_type, body, metadata)
SELECT m.lead_id, NULL, 'status_change'::crm_lead_activity_type,
       'Status changed from new to ' || m.status_to_set || '.',
       jsonb_build_object('backfill', 'historical_sheet', 'from', 'new', 'to', m.status_to_set)
FROM _matched m
WHERE m.status_to_set <> 'new';

-- 3e) remarks as notes (deduped — re-runs never duplicate)
INSERT INTO crm_lead_activities (lead_id, actor_id, activity_type, body, metadata)
SELECT m.lead_id, NULL, 'note'::crm_lead_activity_type,
       m.remarks,
       jsonb_build_object('backfill', 'historical_sheet',
                          'external_lead_id', m.db_external_id,
                          'sheet_status', m.status_to_set)
FROM _matched m
WHERE m.remarks IS NOT NULL AND m.remarks <> ''
  AND NOT EXISTS (SELECT 1 FROM crm_lead_activities a
                  WHERE a.lead_id = m.lead_id
                    AND a.activity_type = 'note'
                    AND a.body = m.remarks);

COMMIT;

-- ─── 4) Verification (post-commit reads) ───

-- Lead pipeline after the backfill
SELECT status, count(*) AS leads FROM crm_leads GROUP BY status ORDER BY count(*) DESC;

-- Location enrichment coverage
SELECT count(*) FILTER (WHERE pincode IS NOT NULL) AS with_pincode,
       count(*) FILTER (WHERE address IS NOT NULL) AS with_address,
       count(*)                                   AS leads_total
FROM crm_leads;

-- Everything this backfill wrote on the lead timelines
SELECT activity_type, count(*) AS activities
FROM crm_lead_activities
WHERE metadata->>'backfill' = 'historical_sheet'
GROUP BY activity_type
ORDER BY activity_type;

-- Converted leads: booking linkage
SELECT count(*) FILTER (WHERE converted_booking_id IS NOT NULL) AS linked_to_booking,
       count(*) FILTER (WHERE converted_booking_id IS NULL)     AS not_linked
FROM crm_leads WHERE status = 'converted';
