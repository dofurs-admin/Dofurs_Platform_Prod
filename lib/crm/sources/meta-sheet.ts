import { createHash } from 'node:crypto';
import { JWT } from 'google-auth-library';
import { toIndianE164 } from '@/lib/utils/india-phone';

// ── Google Sheets Meta lead source (Phase 4a) ─────────────────────────────────
//
// Meta lead forms sync rows into a Google Sheet ("Leads" export). This module
// reads that sheet via a service account and maps rows into CRM lead candidates.
// It only ever READS the sheet — Google-side sync and the sheet itself stay
// untouched, and failures here cannot affect any live platform flow.

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const META_SHEET_DEFAULT_RANGE = 'A:Z';

// ── Configuration ──────────────────────────────────────────────────────────────

export function isMetaSheetImportConfigured() {
  return Boolean(
    getMetaSheetClientEmail() &&
    getMetaSheetPrivateKey() &&
    (process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID ?? '').trim(),
  );
}

function getMetaSheetClientEmail() {
  return (process.env.GOOGLE_SHEETS_CLIENT_EMAIL ?? '').trim();
}

function getMetaSheetPrivateKey() {
  // Render-style env values store the PEM key with literal "\n" sequences.
  return (process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
}

// ── Header mapping (pure, unit-tested) ──────────────────────────────────────────

export type MetaSheetField =
  | 'leadId'
  | 'createdTime'
  | 'name'
  | 'phone'
  | 'email'
  | 'city'
  | 'campaign'
  | 'campaignId'
  | 'adset'
  | 'adsetId'
  | 'ad'
  | 'adId'
  | 'form'
  | 'formId'
  | 'petInfo'
  | 'isOrganic'
  | 'metaLeadStatus'
  | 'platform';

const HEADER_ALIASES: Record<MetaSheetField, readonly string[]> = {
  leadId: ['lead_id', 'leadid', 'lead id', 'id'],
  createdTime: ['created_time', 'created time', 'created at', 'date created', 'date', 'time'],
  name: ['full_name', 'full name', 'name', 'customer_name', 'customer name'],
  phone: [
    'phone_number',
    'phone number',
    'phone',
    'mobile',
    'mobile_number',
    'mobile number',
    'whatsapp_number',
    'whatsapp number',
    'contact_number',
    'contact number',
  ],
  email: ['email', 'e mail', 'email address'],
  city: [
    'city',
    'location',
    'area',
    'which area in bengaluru you want the service?',
    'which area in bengaluru you want the service',
  ],
  campaign: ['campaign_name', 'campaign name', 'campaign'],
  campaignId: ['campaign_id', 'campaign id'],
  adset: ['adset_name', 'adset name', 'ad set_name', 'ad set name', 'adset', 'ad set'],
  adsetId: ['adset_id', 'adset id', 'ad set_id', 'ad set id'],
  ad: ['ad_name', 'ad name', 'ad'],
  adId: ['ad_id', 'ad id'],
  form: ['form_name', 'form name', 'lead form', 'form'],
  formId: ['form_id', 'form id'],
  petInfo: ['which pet do you have?', 'which pet do you have', 'pet', 'pet details', 'pet type'],
  isOrganic: ['is_organic', 'is organic', 'organic'],
  metaLeadStatus: ['lead_status', 'lead status'],
  platform: ['platform', 'source'],
};

export function normalizeMetaSheetHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export type MetaSheetHeaderMap = Partial<Record<MetaSheetField, number>>;

export function buildMetaSheetHeaderMap(headers: readonly string[]): {
  map: MetaSheetHeaderMap;
  warnings: string[];
} {
  const map: MetaSheetHeaderMap = {};
  const warnings: string[] = [];
  const normalized = headers.map((header) => normalizeMetaSheetHeader(header));

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[MetaSheetField, readonly string[]]>) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) {
      map[field] = index;
    }
  }

  if (map.phone === undefined && map.email === undefined) {
    warnings.push('Sheet has neither a phone nor an email column — no leads can be imported.');
  }
  if (map.name === undefined) {
    warnings.push('Sheet has no name column — imported names will fall back to "Pet Owner".');
  }

  return { map, warnings };
}

// ── Row mapping ─────────────────────────────────────────────────────────────────

export type MetaSheetLeadCandidate = {
  externalLeadId: string;
  name: string;
  phone: string | null; // normalized to Indian E.164 when possible
  rawPhone: string | null;
  email: string | null;
  sourceDetails: Record<string, unknown>;
};

export type MapMetaSheetRowsResult = {
  candidates: MetaSheetLeadCandidate[];
  invalidCount: number;
  invalidReasons: string[]; // capped sample of reasons
  emptyCount: number;
  warnings: string[];
};

function cellValue(row: readonly string[], index: number | undefined) {
  if (index === undefined) return '';
  return (row[index] ?? '').toString().trim();
}

function buildExternalLeadId(input: {
  leadId: string;
  createdTime: string;
  rawPhone: string;
  email: string;
  name: string;
}) {
  if (input.leadId) {
    return `lead:${input.leadId}`;
  }

  const hash = createHash('sha256')
    .update(`${input.createdTime}|${input.rawPhone}|${input.email}|${input.name}`)
    .digest('hex')
    .slice(0, 32);

  return `sheet:${hash}`;
}

export function mapMetaSheetRowsToCandidates(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): MapMetaSheetRowsResult {
  const { map, warnings } = buildMetaSheetHeaderMap(headers);
  const usedIndexes = new Set(
    Object.values(map).filter((index): index is number => index !== undefined),
  );
  const candidates: MetaSheetLeadCandidate[] = [];
  const invalidReasons: string[] = [];
  let invalidCount = 0;
  let emptyCount = 0;

  for (const row of rows) {
    const leadId = cellValue(row, map.leadId);
    const createdTime = cellValue(row, map.createdTime);
    const nameRaw = cellValue(row, map.name);
    const phoneRaw = cellValue(row, map.phone);
    const emailRaw = cellValue(row, map.email).toLowerCase();
    const city = cellValue(row, map.city);
    const campaign = cellValue(row, map.campaign);
    const campaignId = cellValue(row, map.campaignId);
    const adset = cellValue(row, map.adset);
    const adsetId = cellValue(row, map.adsetId);
    const ad = cellValue(row, map.ad);
    const adId = cellValue(row, map.adId);
    const form = cellValue(row, map.form);
    const formId = cellValue(row, map.formId);
    const petInfo = cellValue(row, map.petInfo);
    const isOrganic = cellValue(row, map.isOrganic);
    const metaLeadStatus = cellValue(row, map.metaLeadStatus);
    const platform = cellValue(row, map.platform);

    if (!nameRaw && !phoneRaw && !emailRaw && !campaign) {
      emptyCount += 1;
      continue;
    }

    if (!phoneRaw && !emailRaw) {
      invalidCount += 1;
      if (invalidReasons.length < 10) {
        invalidReasons.push(`Row has no phone or email${createdTime ? ` (created ${createdTime})` : ''}.`);
      }
      continue;
    }

    const phone = phoneRaw ? toIndianE164(phoneRaw) : null;
    const email = emailRaw || null;

    // New customers require a valid Indian phone for the existing intake pipeline.
    // Rows with a usable email still import if the customer already exists.
    if (phoneRaw && !phone && !email) {
      invalidCount += 1;
      if (invalidReasons.length < 10) {
        invalidReasons.push(`Phone "${phoneRaw}" could not be normalized to an Indian number and no email present.`);
      }
      continue;
    }

    // Generic passthrough: any non-empty column the alias map doesn't know
    // (new lead-form questions, address, pincode, …) is preserved verbatim so
    // future form changes never lose data.
    const extraFields: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (usedIndexes.has(index)) return;
      const key = normalizeMetaSheetHeader(header).replace(/ +/g, '_');
      if (!key) return;
      const value = cellValue(row, index);
      if (value) {
        extraFields[key] = value;
      }
    });

    candidates.push({
      externalLeadId: buildExternalLeadId({
        leadId,
        createdTime,
        rawPhone: phoneRaw,
        email: emailRaw,
        name: nameRaw,
      }),
      name: nameRaw || 'Pet Owner',
      phone,
      rawPhone: phoneRaw || null,
      email,
      sourceDetails: {
        platform: platform || null,
        campaign: campaign || null,
        campaign_id: campaignId || null,
        adset: adset || null,
        adset_id: adsetId || null,
        ad: ad || null,
        ad_id: adId || null,
        form: form || null,
        form_id: formId || null,
        city: city || null,
        pet_info: petInfo || null,
        is_organic: isOrganic || null,
        meta_lead_status: metaLeadStatus || null,
        created_time: createdTime || null,
        imported_from: 'google_sheet',
        ...(Object.keys(extraFields).length > 0 ? { extra_fields: extraFields } : {}),
      },
    });
  }

  return { candidates, invalidCount, invalidReasons, emptyCount, warnings };
}

// ── Sheet fetching ─────────────────────────────────────────────────────────────

export type MetaSheetTab = {
  title: string;
  headers: string[];
  rows: string[][];
};

/**
 * Optional allow-list of tab (worksheet) titles to import, comma-separated in
 * GOOGLE_SHEETS_LEADS_TABS. Meta's Sheets sync writes leads into per-day/per-batch
 * tabs, and workbooks often also contain non-lead tabs (e.g. hiring applicants,
 * experiments) that must never become CRM customers. An empty/missing value
 * imports ALL tabs — set the env var in production.
 */
export function getMetaSheetTabAllowList(): string[] {
  return (process.env.GOOGLE_SHEETS_LEADS_TABS ?? '')
    .split(',')
    .map((title) => title.trim())
    .filter(Boolean);
}

export async function fetchMetaSheetTabs(): Promise<{
  spreadsheetId: string;
  range: string;
  tabs: MetaSheetTab[];
}> {
  const spreadsheetId = (process.env.GOOGLE_SHEETS_LEADS_SPREADSHEET_ID ?? '').trim();
  const range = (process.env.GOOGLE_SHEETS_LEADS_RANGE ?? META_SHEET_DEFAULT_RANGE).trim() || META_SHEET_DEFAULT_RANGE;

  const jwt = new JWT({
    email: getMetaSheetClientEmail(),
    key: getMetaSheetPrivateKey(),
    scopes: [SHEETS_SCOPE],
  });

  const tokenResult = await jwt.getAccessToken();
  const token = tokenResult?.token ?? '';
  if (!token) {
    throw new Error('Google service account authentication failed (no access token).');
  }

  const headers = { authorization: `Bearer ${token}` };

  const metaUrl = `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(title)`;
  const metaResponse = await fetch(metaUrl, { headers });

  if (!metaResponse.ok) {
    const body = await metaResponse.text().catch(() => '');
    throw new Error(`Google Sheets API ${metaResponse.status}: ${body.slice(0, 400)}`);
  }

  const metaPayload = (await metaResponse.json().catch(() => null)) as
    | { sheets?: Array<{ properties?: { title?: string } }> }
    | null;

  const allTitles = (metaPayload?.sheets ?? [])
    .map((sheet) => (sheet.properties?.title ?? '').trim())
    .filter(Boolean);

  if (allTitles.length === 0) {
    throw new Error('The spreadsheet has no readable tabs.');
  }

  const allowList = getMetaSheetTabAllowList();
  const allowListLower = allowList.map((title) => title.toLowerCase());
  const titles =
    allowList.length > 0
      ? allTitles.filter((title) => allowListLower.includes(title.toLowerCase()))
      : allTitles;

  if (allowList.length > 0 && titles.length === 0) {
    throw new Error(
      `None of the tabs listed in GOOGLE_SHEETS_LEADS_TABS (${allowList.join(', ')}) exist in the spreadsheet. Available tabs: ${allTitles.join(', ')}.`,
    );
  }

  const tabs: MetaSheetTab[] = [];

  for (const title of titles) {
    // Quote the tab name (handles titles with spaces) and escape single quotes.
    const tabRange = `'${title.replace(/'/g, "''")}'!${range}`;
    const valuesUrl = `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(tabRange)}?majorDimension=ROWS`;
    const valuesResponse = await fetch(valuesUrl, { headers });

    if (!valuesResponse.ok) {
      const body = await valuesResponse.text().catch(() => '');
      throw new Error(`Google Sheets API ${valuesResponse.status} (tab "${title}"): ${body.slice(0, 300)}`);
    }

    const valuesPayload = (await valuesResponse.json().catch(() => null)) as { values?: unknown[][] } | null;
    const values = Array.isArray(valuesPayload?.values) ? valuesPayload.values : [];
    const [headerRow = [], ...dataRows] = values;

    tabs.push({
      title,
      headers: headerRow.map((cell) => String(cell ?? '')),
      rows: dataRows.map((row) => row.map((cell) => String(cell ?? ''))),
    });
  }

  return { spreadsheetId, range, tabs };
}


