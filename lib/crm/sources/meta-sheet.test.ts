import { describe, expect, it } from 'vitest';
import {
  buildMetaSheetHeaderMap,
  mapMetaSheetRowsToCandidates,
  normalizeMetaSheetHeader,
} from './meta-sheet';

const META_DEFAULT_HEADERS = [
  'created_time',
  'platform',
  'full_name',
  'phone_number',
  'email',
  'city',
  'campaign_name',
  'adset_name',
  'ad_name',
  'form_name',
];

// The exact header row of the production Meta leads Google Sheet (verified via
// the read-only pre-flight fetch) — locks the mapper against reality.
const LIVE_SHEET_HEADERS = [
  'id',
  'created_time',
  'ad_id',
  'ad_name',
  'adset_id',
  'adset_name',
  'campaign_id',
  'campaign_name',
  'form_id',
  'form_name',
  'is_organic',
  'platform',
  'which_pet_do_you_have?',
  'which_area_in_bengaluru_you_want_the_service?',
  'full_name',
  'phone_number',
  'lead_status',
];

describe('normalizeMetaSheetHeader', () => {
  it('normalizes casing, punctuation and padding', () => {
    expect(normalizeMetaSheetHeader('  Full_Name  ')).toBe('full name');
    expect(normalizeMetaSheetHeader('AdSetName')).toBe('adsetname');
    expect(normalizeMetaSheetHeader('Phone-Number')).toBe('phone number');
  });
});

describe('buildMetaSheetHeaderMap', () => {
  it('maps Meta default export columns', () => {
    const { map, warnings } = buildMetaSheetHeaderMap(META_DEFAULT_HEADERS);

    expect(map.createdTime).toBe(0);
    expect(map.platform).toBe(1);
    expect(map.name).toBe(2);
    expect(map.phone).toBe(3);
    expect(map.email).toBe(4);
    expect(map.campaign).toBe(6);
    expect(map.adset).toBe(7);
    expect(map.ad).toBe(8);
    expect(map.form).toBe(9);
    expect(warnings).toEqual([]);
  });

  it('is case and separator tolerant', () => {
    const { map } = buildMetaSheetHeaderMap(['Created Time', 'Full Name', 'Phone Number', 'E-mail']);

    expect(map.createdTime).toBe(0);
    expect(map.name).toBe(1);
    expect(map.phone).toBe(2);
    expect(map.email).toBe(3);
  });

  it('warns when no contact column exists', () => {
    const { warnings } = buildMetaSheetHeaderMap(['created_time', 'full_name', 'campaign_name']);

    expect(warnings.some((warning) => warning.includes('neither a phone nor an email'))).toBe(true);
  });
});

describe('mapMetaSheetRowsToCandidates', () => {
  it('maps a valid row with attribution details', () => {
    const result = mapMetaSheetRowsToCandidates(META_DEFAULT_HEADERS, [
      [
        '2026/09/01 10:15:00',
        'fb',
        'Ravi Kumar',
        '9876543210',
        'ravi@example.com',
        'Bengaluru',
        'Grooming-Sep-Offer',
        'AdSet A',
        'Ad 1',
        'Lead Form - Grooming',
      ],
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.invalidCount).toBe(0);

    const candidate = result.candidates[0]!;
    expect(candidate.name).toBe('Ravi Kumar');
    expect(candidate.phone).toBe('+919876543210');
    expect(candidate.email).toBe('ravi@example.com');
    expect(candidate.sourceDetails.campaign).toBe('Grooming-Sep-Offer');
    expect(candidate.sourceDetails.adset).toBe('AdSet A');
    expect(candidate.sourceDetails.ad).toBe('Ad 1');
    expect(candidate.sourceDetails.form).toBe('Lead Form - Grooming');
    expect(candidate.sourceDetails.imported_from).toBe('google_sheet');
  });

  it('produces a stable external id for identical rows and distinct ids for different rows', () => {
    const row = ['2026/09/01 10:15:00', 'fb', 'Ravi', '9876543210', '', '', '', '', '', ''];

    const first = mapMetaSheetRowsToCandidates(META_DEFAULT_HEADERS, [row]);
    const second = mapMetaSheetRowsToCandidates(META_DEFAULT_HEADERS, [row]);
    const other = mapMetaSheetRowsToCandidates(META_DEFAULT_HEADERS, [
      ['2026/09/02 11:00:00', 'fb', 'Ravi', '9876543210', '', '', '', '', '', ''],
    ]);

    expect(first.candidates[0]!.externalLeadId).toBe(second.candidates[0]!.externalLeadId);
    expect(first.candidates[0]!.externalLeadId).not.toBe(other.candidates[0]!.externalLeadId);
  });

  it('prefers an explicit lead id column when present', () => {
    const headers = ['lead_id', ...META_DEFAULT_HEADERS];
    const row = ['1234567890', '2026/09/01 10:15:00', 'fb', 'Ravi', '9876543210', '', '', '', '', '', ''];

    const result = mapMetaSheetRowsToCandidates(headers, [row]);

    expect(result.candidates[0]!.externalLeadId).toBe('lead:1234567890');
  });

  it('skips empty rows and invalid rows with reasons', () => {
    const result = mapMetaSheetRowsToCandidates(META_DEFAULT_HEADERS, [
      ['', '', '', '', '', '', '', '', '', ''], // fully empty
      ['2026/09/01 10:15:00', 'fb', 'No Contact', '', '', '', 'SomeCampaign', '', '', ''], // no phone/email
    ]);

    expect(result.emptyCount).toBe(1);
    expect(result.candidates).toHaveLength(0);
    expect(result.invalidCount).toBe(1);
    expect(result.invalidReasons[0]).toContain('no phone or email');
  });

  it('falls back to Pet Owner when the name is blank', () => {
    const result = mapMetaSheetRowsToCandidates(META_DEFAULT_HEADERS, [
      ['2026/09/01 10:15:00', 'fb', '', '9876543210', '', '', '', '', '', ''],
    ]);

    expect(result.candidates[0]!.name).toBe('Pet Owner');
  });

  it('keeps email-only rows as candidates (customer matching happens at import time)', () => {
    const result = mapMetaSheetRowsToCandidates(META_DEFAULT_HEADERS, [
      ['2026/09/01 10:15:00', 'fb', 'Ravi', '', 'ravi@example.com', '', '', '', '', ''],
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.phone).toBeNull();
    expect(result.candidates[0]!.email).toBe('ravi@example.com');
  });

  it('maps the live production sheet header row completely', () => {
    const { map, warnings } = buildMetaSheetHeaderMap(LIVE_SHEET_HEADERS);

    expect(map.leadId).toBe(0);
    expect(map.createdTime).toBe(1);
    expect(map.adId).toBe(2);
    expect(map.ad).toBe(3);
    expect(map.adsetId).toBe(4);
    expect(map.adset).toBe(5);
    expect(map.campaignId).toBe(6);
    expect(map.campaign).toBe(7);
    expect(map.formId).toBe(8);
    expect(map.form).toBe(9);
    expect(map.isOrganic).toBe(10);
    expect(map.platform).toBe(11);
    expect(map.petInfo).toBe(12);
    expect(map.city).toBe(13);
    expect(map.name).toBe(14);
    expect(map.phone).toBe(15);
    expect(map.metaLeadStatus).toBe(16);
    expect(warnings).toEqual([]);
  });

  it('captures full attribution from a live-format row', () => {
    const result = mapMetaSheetRowsToCandidates(LIVE_SHEET_HEADERS, [
      [
        '9988776655443322',
        '2026/09/01 09:30:00',
        '120300000009',
        'Grooming September Offer',
        '120300000011',
        'Bengaluru Grooming',
        '120300000017',
        'Dofurs_Sep_Grooming',
        '888999000',
        'Grooming Lead Form',
        'false',
        'fb',
        'Labrador, 3 years',
        'HSR Layout',
        'Ravi Kumar',
        '9876543210',
        '',
      ],
    ]);

    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0]!;
    expect(candidate.externalLeadId).toBe('lead:9988776655443322');
    expect(candidate.phone).toBe('+919876543210');
    expect(candidate.sourceDetails.campaign_id).toBe('120300000017');
    expect(candidate.sourceDetails.adset_id).toBe('120300000011');
    expect(candidate.sourceDetails.ad_id).toBe('120300000009');
    expect(candidate.sourceDetails.form_id).toBe('888999000');
    expect(candidate.sourceDetails.pet_info).toBe('Labrador, 3 years');
    expect(candidate.sourceDetails.city).toBe('HSR Layout');
    expect(candidate.sourceDetails.is_organic).toBe('false');
  });

  it('passes unknown non-empty columns through to extra_fields', () => {
    const headers = [...LIVE_SHEET_HEADERS.slice(0, 16), 'pincode', 'street_address', 'lead_status'];
    const row = [
      '9988776655443322',
      '2026/09/01 09:30:00',
      '120300000009',
      'Ad 1',
      '120300000011',
      'AdSet 1',
      '120300000017',
      'Campaign 1',
      '888999000',
      'Form 1',
      'false',
      'fb',
      'Labrador',
      'HSR Layout',
      'Ravi Kumar',
      '9876543210',
      '560102',
      '12th Main, HSR',
      '',
    ];

    const result = mapMetaSheetRowsToCandidates(headers, [row]);
    const details = result.candidates[0]!.sourceDetails as Record<string, unknown>;
    const extraFields = details.extra_fields as Record<string, string>;

    expect(extraFields.pincode).toBe('560102');
    expect(extraFields.street_address).toBe('12th Main, HSR');
  });
});
