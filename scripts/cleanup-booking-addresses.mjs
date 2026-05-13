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
    apply: false,
    batchSize: 500,
    limit: 20000,
    startId: 0,
    maxApply: 5000,
    sampleSize: 25,
    outputDir: 'audit-output',
    help: false,
  };

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }

    if (raw === '--apply') {
      args.apply = true;
      continue;
    }

    if (raw.startsWith('--batch-size=')) {
      args.batchSize = Math.max(1, Number(raw.split('=')[1] ?? args.batchSize));
      continue;
    }

    if (raw.startsWith('--limit=')) {
      args.limit = Math.max(1, Number(raw.split('=')[1] ?? args.limit));
      continue;
    }

    if (raw.startsWith('--start-id=')) {
      args.startId = Math.max(0, Number(raw.split('=')[1] ?? args.startId));
      continue;
    }

    if (raw.startsWith('--max-apply=')) {
      args.maxApply = Math.max(1, Number(raw.split('=')[1] ?? args.maxApply));
      continue;
    }

    if (raw.startsWith('--sample-size=')) {
      args.sampleSize = Math.max(1, Number(raw.split('=')[1] ?? args.sampleSize));
      continue;
    }

    if (raw.startsWith('--output-dir=')) {
      args.outputDir = raw.split('=')[1] ?? args.outputDir;
    }
  }

  return args;
}

function normalizeSegment(value) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function collectUniqueAddressSegments(parts) {
  const seen = new Set();
  const result = [];

  for (const part of parts) {
    if (typeof part !== 'string') {
      continue;
    }

    const segments = part
      .split(',')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    for (const segment of segments) {
      const normalized = normalizeSegment(segment);

      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(segment);
    }
  }

  return result;
}

function sanitizeAddressText(address) {
  if (typeof address !== 'string') {
    return null;
  }

  const normalized = collectUniqueAddressSegments([address]).join(', ');
  return normalized.length > 0 ? normalized : null;
}

function toIdNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function printHelp() {
  console.log('Normalize duplicated booking location addresses in historical rows.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/cleanup-booking-addresses.mjs [--limit=20000] [--batch-size=500] [--start-id=0] [--sample-size=25] [--output-dir=audit-output]');
  console.log('  node scripts/cleanup-booking-addresses.mjs --apply [--max-apply=5000] [--limit=20000] [--batch-size=500]');
  console.log('');
  console.log('Defaults:');
  console.log('  dry-run mode (no DB writes) unless --apply is provided');
  console.log('');
  console.log('Environment:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL');
  console.log('  SUPABASE_SERVICE_ROLE_KEY');
  console.log('');
  console.log('Output:');
  console.log('  booking-address-cleanup-<timestamp>.json in audit-output/ by default');
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const root = process.cwd();
  const envPath = path.join(root, '.env.local');
  const fileEnv = fs.existsSync(envPath) ? parseEnvLocal(envPath) : {};

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let lastId = Math.max(0, Math.floor(args.startId));
  let scannedRows = 0;
  let candidateCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  const sampleChanges = [];
  const failures = [];

  console.log('Booking address cleanup started');
  console.log(`- mode: ${args.apply ? 'apply' : 'dry-run'}`);
  console.log(`- scan limit: ${args.limit}`);
  console.log(`- batch size: ${args.batchSize}`);
  console.log(`- start id: ${lastId}`);
  if (args.apply) {
    console.log(`- max apply: ${args.maxApply}`);
  }

  while (scannedRows < args.limit) {
    const pageSize = Math.min(args.batchSize, args.limit - scannedRows);

    const { data, error } = await supabase
      .from('bookings')
      .select('id, location_address')
      .not('location_address', 'is', null)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(pageSize);

    if (error) {
      throw new Error(`Failed while scanning bookings: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      break;
    }

    scannedRows += rows.length;

    for (const row of rows) {
      const numericId = toIdNumber(row.id);
      if (numericId !== null && numericId > lastId) {
        lastId = numericId;
      }

      const currentAddress = typeof row.location_address === 'string' ? row.location_address.trim() : '';
      if (!currentAddress) {
        continue;
      }

      const normalizedAddress = sanitizeAddressText(currentAddress);
      if (!normalizedAddress || normalizedAddress === currentAddress) {
        continue;
      }

      candidateCount += 1;

      if (sampleChanges.length < args.sampleSize) {
        sampleChanges.push({
          booking_id: row.id,
          before: currentAddress,
          after: normalizedAddress,
        });
      }

      if (!args.apply) {
        continue;
      }

      if (updatedCount >= args.maxApply) {
        continue;
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ location_address: normalizedAddress })
        .eq('id', row.id);

      if (updateError) {
        failedCount += 1;
        if (failures.length < args.sampleSize) {
          failures.push({
            booking_id: row.id,
            error: updateError.message,
          });
        }
      } else {
        updatedCount += 1;
      }
    }

    if (args.apply && updatedCount >= args.maxApply) {
      break;
    }
  }

  const outputDir = path.join(root, args.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDir, `booking-address-cleanup-${timestamp}.json`);

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    limits: {
      scan_limit: args.limit,
      batch_size: args.batchSize,
      start_id: args.startId,
      max_apply: args.apply ? args.maxApply : 0,
    },
    summary: {
      scanned_rows: scannedRows,
      candidate_rows: candidateCount,
      updated_rows: updatedCount,
      failed_rows: failedCount,
      capped_by_max_apply: args.apply ? updatedCount >= args.maxApply && candidateCount > updatedCount : false,
      last_scanned_id: lastId,
    },
    sample_changes: sampleChanges,
    failures,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('Cleanup completed');
  console.log(`- scanned rows: ${scannedRows}`);
  console.log(`- candidate rows: ${candidateCount}`);
  console.log(`- updated rows: ${updatedCount}`);
  console.log(`- failed rows: ${failedCount}`);
  console.log(`- report: ${reportPath}`);
}

run().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});