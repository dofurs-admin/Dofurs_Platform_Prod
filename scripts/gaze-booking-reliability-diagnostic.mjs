// Read-only diagnostic for the Gaze booking-layer reliability report:
// "N active confirmed bookings in the admin Bookings tab, but Gaze shows fewer."
//
// Replicates the exact /api/admin/gaze booking pipeline (window DB range on
// booking_start with 1-day IST padding, precise date-key filter preferring
// booking_date, status normalization, mappable-coordinate rules) and compares
// it with the admin Bookings tab "confirmed" view (no date bounds).
//
// Usage: node scripts/gaze-booking-reliability-diagnostic.mjs
// READ-ONLY: only SELECTs; never mutates data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const IST_TZ = 'Asia/Kolkata';
const BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
const BOOKING_POINT_LIMIT = 1000; // mirrors app/api/admin/gaze/route.ts

function parseEnvLocal(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }

  return env;
}

function getISTDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

function getISTDayBoundaryISO(dateKey) {
  const parsed = Date.parse(`${dateKey}T00:00:00.000+05:30`);
  if (Number.isNaN(parsed)) throw new Error(`Invalid IST date key: ${dateKey}`);
  return new Date(parsed).toISOString();
}

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Mirror of lib/gaze/aggregates.ts resolveGazeDateKey
function resolveGazeDateKey({ bookingDate, bookingStart }) {
  const normalizedBookingDate = bookingDate?.trim();
  if (normalizedBookingDate && /^\d{4}-\d{2}-\d{2}$/.test(normalizedBookingDate)) {
    return normalizedBookingDate;
  }

  const normalizedBookingStart = bookingStart?.trim();
  if (!normalizedBookingStart) return null;

  const parsed = new Date(normalizedBookingStart);
  if (Number.isNaN(parsed.getTime())) return null;

  return getISTDateString(parsed);
}

// Mirror of lib/gaze/aggregates.ts toMappableCoordinateOrNull
function toMappableCoordinateOrNull(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

// Mirror of app/api/admin/gaze/route.ts normalizeBookingStatusValue
function normalizeBookingStatusValue(value) {
  return BOOKING_STATUSES.includes(value) ? value : 'pending';
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const env = parseEnvLocal(path.join(scriptDir, '..', '.env.local'));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local and process env).');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const todayKey = getISTDateString();

const windows = [
  { key: 'today', fromDate: todayKey, toDate: todayKey },
  { key: '7d', fromDate: addDaysToDateKey(todayKey, -6), toDate: todayKey },
  { key: '30d', fromDate: addDaysToDateKey(todayKey, -29), toDate: todayKey },
  { key: '90d', fromDate: addDaysToDateKey(todayKey, -89), toDate: todayKey },
  { key: 'alltime', fromDate: null, toDate: null },
];

for (const window of windows) {
  window.dbLower = window.fromDate ? getISTDayBoundaryISO(addDaysToDateKey(window.fromDate, -1)) : null;
  window.dbUpper = window.toDate ? getISTDayBoundaryISO(addDaysToDateKey(window.toDate, 1)) : null;
}

console.log(`IST today: ${todayKey}`);
console.log('Windows (precise date-key bounds + padded booking_start DB bounds):');
for (const window of windows) {
  const precise = window.fromDate ? `${window.fromDate}..${window.toDate}` : 'none';
  const db = window.dbLower ? `${window.dbLower}..${window.dbUpper}` : 'none';
  console.log(`  ${window.key.padEnd(7)} precise: ${precise.padEnd(23)} db: ${db}`);
}
console.log('');

// ── Step 1: every effectively-confirmed booking (what the Bookings tab shows) ──
const { data: confirmedRows, error: confirmedError } = await supabase
  .from('bookings')
  .select(
    'id, provider_id, booking_start, booking_date, start_time, status, booking_status, booking_mode, latitude, longitude, created_at',
  )
  .or('booking_status.eq.confirmed,status.eq.confirmed')
  .order('booking_start', { ascending: false })
  .limit(500);

if (confirmedError) {
  throw new Error(`Failed to fetch confirmed bookings: ${confirmedError.message}`);
}

// The Bookings tab effective status: booking_status ?? status (an off-enum value
// would not equal 'confirmed' either way).
const effectivelyConfirmed = (confirmedRows ?? []).filter((row) => {
  const effectiveStatus = (row.booking_status ?? row.status)?.trim();
  return effectiveStatus === 'confirmed';
});

console.log(`Confirmed bookings in DB (effective status = 'confirmed', any date): ${effectivelyConfirmed.length}`);
console.log('');

// ── Step 2: how many rows does the Gaze DB query actually see per window? ──
for (const window of windows.filter((w) => w.dbLower)) {
  let query = supabase.from('bookings').select('id', { count: 'exact', head: true });
  if (window.dbLower) query = query.gte('booking_start', window.dbLower);
  if (window.dbUpper) query = query.lte('booking_start', window.dbUpper);
  const { count, error } = await query;
  if (error) throw new Error(`Count query failed for window ${window.key}: ${error.message}`);
  const atRisk = count > BOOKING_POINT_LIMIT ? '  ⚠ EXCEEDS 1000-row Gaze fetch limit (older rows crowded out)' : '';
  console.log(`Rows matching Gaze DB range [${window.key}]: ${count}${atRisk}`);
}
console.log('');

// ── Step 3: per-booking pipeline walk ──
function evaluateRow(row, window) {
  const reasons = [];

  if (window.dbLower || window.dbUpper) {
    const start = row.booking_start ? new Date(row.booking_start) : null;
    if (!start || Number.isNaN(start.getTime())) {
      reasons.push('booking_start unparseable → row never fetched');
    } else {
      if (window.dbLower && start.toISOString() < window.dbLower) {
        reasons.push(`booking_start ${row.booking_start} below DB lower bound ${window.dbLower}`);
      }
      if (window.dbUpper && start.toISOString() > window.dbUpper) {
        reasons.push(`booking_start ${row.booking_start} above DB upper bound ${window.dbUpper}`);
      }
    }
  }

  const dateKey = resolveGazeDateKey({ bookingDate: row.booking_date, bookingStart: row.booking_start });

  if (!dateKey) {
    reasons.push('no resolvable date key (booking_date malformed + booking_start missing)');
  } else {
    if (window.fromDate && dateKey < window.fromDate) {
      reasons.push(`date key ${dateKey} before window start ${window.fromDate}`);
    }
    if (window.toDate && dateKey > window.toDate) {
      reasons.push(`date key ${dateKey} after window end ${window.toDate} (FUTURE service date — Gaze preset windows end today)`);
    }
  }

  const normalizedStatus = normalizeBookingStatusValue((row.booking_status ?? row.status)?.trim());
  if (normalizedStatus !== 'confirmed') {
    reasons.push(`normalized status is '${normalizedStatus}', not 'confirmed'`);
  }

  const lat = toMappableCoordinateOrNull(row.latitude);
  const lng = toMappableCoordinateOrNull(row.longitude);
  const pinnable = lat !== null && lng !== null;
  if (!pinnable) {
    reasons.push(`no mappable coordinates (latitude=${row.latitude}, longitude=${row.longitude}) — counted in KPIs, no map pin`);
  }

  return { visible: reasons.length === 0, pinnable, dateKey, reasons };
}

const resultsByWindow = new Map(windows.map((window) => [window.key, { visible: 0, pinnable: 0 }]));

for (const row of effectivelyConfirmed) {
  const perWindow = {};

  for (const window of windows) {
    const outcome = evaluateRow(row, window);
    perWindow[window.key] = outcome;
    if (outcome.visible) resultsByWindow.get(window.key).visible += 1;
    if (outcome.visible && outcome.pinnable) resultsByWindow.get(window.key).pinnable += 1;
  }

  console.log(`Booking #${row.id}`);
  console.log(`  booking_date=${row.booking_date ?? 'null'}  start_time=${row.start_time ?? 'null'}  booking_start=${row.booking_start ?? 'null'}`);
  console.log(`  booking_status=${row.booking_status ?? 'null'}  status=${row.status ?? 'null'}  mode=${row.booking_mode ?? 'null'}  provider_id=${row.provider_id}`);
  console.log(`  lat=${row.latitude ?? 'null'}  lng=${row.longitude ?? 'null'}  resolved date key=${perWindow['30d'].dateKey ?? 'null'}`);

  for (const window of windows) {
    const outcome = perWindow[window.key];
    const flag = outcome.visible ? (outcome.pinnable ? 'VISIBLE (+pin)' : 'VISIBLE (no pin)') : 'HIDDEN';
    console.log(`    window ${window.key.padEnd(7)} → ${flag}`);
    for (const reason of outcome.reasons) {
      console.log(`        - ${reason}`);
    }
  }

  console.log('');
}

console.log('── Summary ──────────────────────────────────────────────────────');
console.log(`Admin Bookings tab (filter=confirmed, no date bounds): ${effectivelyConfirmed.length} booking(s)`);

for (const window of windows) {
  const stats = resultsByWindow.get(window.key);
  console.log(`Gaze window ${window.key.padEnd(7)}: ${stats.visible} visible (${stats.pinnable} with map pins)`);
}
