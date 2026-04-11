import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseEnvLocal(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }

  return env;
}

function parseArgs(argv) {
  const args = {
    fromDays: 30,
    maxBookings: 1000,
    outputDir: 'audit-output',
    help: false,
  };

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }

    if (raw.startsWith('--from-days=')) {
      args.fromDays = Math.max(1, Number(raw.split('=')[1] ?? '30'));
      continue;
    }

    if (raw.startsWith('--max-bookings=')) {
      args.maxBookings = Math.max(1, Number(raw.split('=')[1] ?? '1000'));
      continue;
    }

    if (raw.startsWith('--output-dir=')) {
      args.outputDir = raw.split('=')[1] ?? 'audit-output';
      continue;
    }
  }

  return args;
}

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function toServiceFamily(value) {
  const normalized = normalizeToken(value);

  if (!normalized) return '';
  if (normalized.includes('groom')) return 'grooming';
  if (normalized.includes('vet') || normalized.includes('consult')) return 'vet_consultation';
  if (normalized.includes('train')) return 'training';
  if (normalized.includes('board')) return 'boarding';
  if (normalized.includes('sit')) return 'sitting';
  if (normalized.includes('walk')) return 'walking';
  if (normalized.includes('birthday') || normalized.includes('bday')) return 'birthday';
  if (normalized.includes('daycare') || normalized.includes('day_care')) return 'daycare';

  return normalized;
}

function isServiceTypeMatch(left, right) {
  const leftNorm = normalizeToken(left);
  const rightNorm = normalizeToken(right);

  if (!leftNorm || !rightNorm) return false;
  if (leftNorm === rightNorm) return true;
  return toServiceFamily(leftNorm) === toServiceFamily(rightNorm);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function isActiveWindow(sub) {
  const nowMs = Date.now();
  const startsAtMs = sub.starts_at ? Date.parse(sub.starts_at) : Number.NaN;
  const endsAtMs = sub.ends_at ? Date.parse(sub.ends_at) : Number.NaN;

  return (
    sub.status === 'active' &&
    Number.isFinite(startsAtMs) &&
    Number.isFinite(endsAtMs) &&
    startsAtMs <= nowMs &&
    endsAtMs >= nowMs
  );
}

function pickBestCredit(subscriptions, serviceType) {
  for (const sub of subscriptions) {
    if (!isActiveWindow(sub)) continue;

    const credits = Array.isArray(sub.user_service_credits) ? sub.user_service_credits : [];
    const matching = credits.find((credit) => isServiceTypeMatch(credit.service_type, serviceType));

    if (matching) {
      return {
        user_subscription_id: sub.id,
        credit_id: matching.id,
        credit_service_type: matching.service_type,
        available_credits: Number(matching.available_credits ?? 0),
        consumed_credits: Number(matching.consumed_credits ?? 0),
        total_credits: Number(matching.total_credits ?? 0),
      };
    }
  }

  return null;
}

function buildReconciliationSql(entry) {
  const eventType = entry.booking_status === 'completed' ? 'consumed' : 'reserved';
  const linkStatus = entry.booking_status === 'completed' ? 'consumed' : 'reserved';
  const notes = `Backfill from audit script at ${nowIso()}`.replace(/'/g, "''");

  return [
    '-- ------------------------------------------------------------',
    `-- booking_id=${entry.booking_id} user_id=${entry.user_id} service_type=${entry.service_type}`,
    'BEGIN;',
    `UPDATE user_service_credits`,
    `SET available_credits = available_credits - 1,`,
    `    consumed_credits = consumed_credits + 1`,
    `WHERE id = '${entry.credit_id}' AND available_credits > 0;`,
    '',
    `INSERT INTO booking_subscription_credit_links (booking_id, user_id, user_subscription_id, service_type, status)`,
    `VALUES (${entry.booking_id}, '${entry.user_id}', '${entry.user_subscription_id}', '${entry.credit_service_type}', '${linkStatus}')`,
    `ON CONFLICT (booking_id) DO UPDATE`,
    `SET user_id = EXCLUDED.user_id,`,
    `    user_subscription_id = EXCLUDED.user_subscription_id,`,
    `    service_type = EXCLUDED.service_type,`,
    `    status = EXCLUDED.status;`,
    '',
    `INSERT INTO credit_usage_events (booking_credit_link_id, user_id, user_subscription_id, booking_id, service_type, event_type, notes)`,
    `SELECT l.id, '${entry.user_id}', '${entry.user_subscription_id}', ${entry.booking_id}, '${entry.credit_service_type}', '${eventType}', '${notes}'`,
    `FROM booking_subscription_credit_links l`,
    `WHERE l.booking_id = ${entry.booking_id};`,
    'COMMIT;',
    '-- ------------------------------------------------------------',
    '',
  ].join('\n');
}

function printHelp() {
  console.log('Audit potentially missed subscription-credit bookings and generate a reconciliation plan.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/audit-subscription-credit-bookings.mjs [--from-days=30] [--max-bookings=1000] [--output-dir=audit-output]');
  console.log('');
  console.log('Environment:');
  console.log('  Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local');
  console.log('');
  console.log('Output files:');
  console.log('  subscription-credit-audit-<timestamp>.json');
  console.log('  subscription-credit-reconciliation-<timestamp>.sql');
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const root = process.cwd();
  const envPath = path.join(root, '.env.local');

  if (!fs.existsSync(envPath)) {
    console.error('FAIL: .env.local not found');
    process.exit(1);
  }

  const env = parseEnvLocal(envPath);
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((key) => !env[key] || env[key] === '');

  if (missing.length > 0) {
    console.error(`FAIL: Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const from = new Date(now.getTime() - args.fromDays * 24 * 60 * 60 * 1000);
  const fromIso = from.toISOString();
  const toIso = now.toISOString();

  console.log('Subscription-credit audit started');
  console.log(`- window: ${formatDate(from)} -> ${formatDate(now)}`);
  console.log(`- max bookings scanned: ${args.maxBookings}`);

  const { data: bookings, error: bookingsError } = await admin
    .from('bookings')
    .select('id, user_id, service_type, booking_status, payment_mode, wallet_credits_applied_inr, created_at')
    .eq('payment_mode', 'platform')
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(args.maxBookings);

  if (bookingsError) {
    console.error(`FAIL: Could not load bookings :: ${bookingsError.message}`);
    process.exit(1);
  }

  const bookingRows = Array.isArray(bookings) ? bookings : [];

  if (bookingRows.length === 0) {
    console.log('No platform bookings found in the selected window.');
    return;
  }

  const bookingIds = bookingRows.map((row) => row.id);

  const [paymentTxResult, creditLinksResult] = await Promise.all([
    admin
      .from('payment_transactions')
      .select('id, booking_id, status, transaction_type')
      .in('booking_id', bookingIds)
      .eq('transaction_type', 'service_collection'),
    admin
      .from('booking_subscription_credit_links')
      .select('id, booking_id, status, user_subscription_id, service_type')
      .in('booking_id', bookingIds),
  ]);

  if (paymentTxResult.error) {
    console.error(`FAIL: Could not load payment transactions :: ${paymentTxResult.error.message}`);
    process.exit(1);
  }

  if (creditLinksResult.error) {
    console.error(`FAIL: Could not load credit links :: ${creditLinksResult.error.message}`);
    process.exit(1);
  }

  const txByBookingId = new Map();
  for (const tx of paymentTxResult.data ?? []) {
    if (!tx?.booking_id) continue;
    txByBookingId.set(tx.booking_id, tx);
  }

  const linkByBookingId = new Map();
  for (const link of creditLinksResult.data ?? []) {
    if (!link?.booking_id) continue;
    linkByBookingId.set(link.booking_id, link);
  }

  const suspicious = bookingRows.filter((row) => {
    const hasPaymentTx = txByBookingId.has(row.id);
    const hasCreditLink = linkByBookingId.has(row.id);
    return !hasPaymentTx && !hasCreditLink;
  });

  const uniqueUserIds = Array.from(new Set(suspicious.map((row) => row.user_id)));

  const subscriptionsByUserId = new Map();

  if (uniqueUserIds.length > 0) {
    const { data: subscriptions, error: subError } = await admin
      .from('user_subscriptions')
      .select('id, user_id, status, starts_at, ends_at, user_service_credits(id, service_type, total_credits, available_credits, consumed_credits)')
      .in('user_id', uniqueUserIds)
      .eq('status', 'active')
      .order('ends_at', { ascending: false });

    if (subError) {
      console.error(`FAIL: Could not load user subscriptions :: ${subError.message}`);
      process.exit(1);
    }

    for (const sub of subscriptions ?? []) {
      const current = subscriptionsByUserId.get(sub.user_id) ?? [];
      current.push(sub);
      subscriptionsByUserId.set(sub.user_id, current);
    }
  }

  const reviewed = suspicious.map((row) => {
    const subs = subscriptionsByUserId.get(row.user_id) ?? [];
    const bestCredit = pickBestCredit(subs, row.service_type ?? '');

    if (row.booking_status === 'cancelled') {
      return {
        booking_id: row.id,
        user_id: row.user_id,
        service_type: row.service_type,
        booking_status: row.booking_status,
        created_at: row.created_at,
        outcome: 'skip_cancelled',
        reason: 'Booking is cancelled; no credit backfill needed.',
      };
    }

    if (!bestCredit) {
      return {
        booking_id: row.id,
        user_id: row.user_id,
        service_type: row.service_type,
        booking_status: row.booking_status,
        created_at: row.created_at,
        outcome: 'manual_review',
        reason: 'No active matching subscription credit row found.',
      };
    }

    if (bestCredit.available_credits <= 0) {
      return {
        booking_id: row.id,
        user_id: row.user_id,
        service_type: row.service_type,
        booking_status: row.booking_status,
        created_at: row.created_at,
        outcome: 'manual_review',
        reason: 'Matching subscription found but available_credits is 0.',
        ...bestCredit,
      };
    }

    return {
      booking_id: row.id,
      user_id: row.user_id,
      service_type: row.service_type,
      booking_status: row.booking_status,
      created_at: row.created_at,
      outcome: 'reserve_possible',
      reason: 'Safe candidate for one-credit backfill.',
      ...bestCredit,
    };
  });

  const reservePossible = reviewed.filter((row) => row.outcome === 'reserve_possible');
  const manualReview = reviewed.filter((row) => row.outcome === 'manual_review');
  const skippedCancelled = reviewed.filter((row) => row.outcome === 'skip_cancelled');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(root, args.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const reportPath = path.join(outputDir, `subscription-credit-audit-${timestamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generated_at: nowIso(),
        window: { from: fromIso, to: toIso, from_days: args.fromDays },
        scanned_platform_bookings: bookingRows.length,
        suspicious_without_payment_tx_or_credit_link: suspicious.length,
        reserve_possible_count: reservePossible.length,
        manual_review_count: manualReview.length,
        skipped_cancelled_count: skippedCancelled.length,
        reviewed,
      },
      null,
      2,
    ),
  );

  const sqlPath = path.join(outputDir, `subscription-credit-reconciliation-${timestamp}.sql`);
  const sqlBody = [
    `-- Generated at ${nowIso()}`,
    `-- Window: ${fromIso} -> ${toIso}`,
    '-- Review each block before executing in production.',
    '',
    ...reservePossible.map((entry) => buildReconciliationSql(entry)),
  ].join('\n');
  fs.writeFileSync(sqlPath, sqlBody);

  console.log('Audit completed');
  console.log(`- platform bookings scanned: ${bookingRows.length}`);
  console.log(`- suspicious (no payment tx + no credit link): ${suspicious.length}`);
  console.log(`- reserve_possible: ${reservePossible.length}`);
  console.log(`- manual_review: ${manualReview.length}`);
  console.log(`- skip_cancelled: ${skippedCancelled.length}`);
  console.log(`- JSON report: ${reportPath}`);
  console.log(`- SQL reconciliation plan: ${sqlPath}`);
}

run().catch((error) => {
  console.error(`FAIL: Audit crashed :: ${error?.message ?? error}`);
  process.exit(1);
});
