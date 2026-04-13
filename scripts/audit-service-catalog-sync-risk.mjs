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
    outputDir: 'audit-output',
    maxRows: 50000,
    sampleSize: 10,
    failOnRisk: false,
    help: false,
  };

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }

    if (raw.startsWith('--output-dir=')) {
      args.outputDir = raw.split('=')[1] || 'audit-output';
      continue;
    }

    if (raw.startsWith('--max-rows=')) {
      args.maxRows = Math.max(100, Number(raw.split('=')[1] || '50000'));
      continue;
    }

    if (raw.startsWith('--sample-size=')) {
      args.sampleSize = Math.max(1, Number(raw.split('=')[1] || '10'));
      continue;
    }

    if (raw === '--fail-on-risk') {
      args.failOnRisk = true;
    }
  }

  return args;
}

function printHelp() {
  console.log('Read-only audit for provider_services duplicate-risk in catalog templates and provider rollout rows.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/audit-service-catalog-sync-risk.mjs [--output-dir=audit-output] [--max-rows=50000] [--sample-size=10] [--fail-on-risk]');
  console.log('');
  console.log('Environment:');
  console.log('  Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local');
  console.log('');
  console.log('Output:');
  console.log('  service-catalog-sync-risk-<timestamp>.json');
}

function normalizeServiceType(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeServiceMode(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || 'home_visit';
}

function buildGroupKeyForTemplate(row) {
  return `${normalizeServiceType(row.service_type)}|${normalizeServiceMode(row.service_mode)}`;
}

function buildGroupKeyForProvider(row) {
  return `${row.provider_id}|${normalizeServiceType(row.service_type)}|${normalizeServiceMode(row.service_mode)}`;
}

function buildGroupSummary(key, rows) {
  const providerIds = Array.from(new Set(rows.map((row) => row.provider_id).filter((value) => Number.isFinite(value))));
  return {
    key,
    row_count: rows.length,
    ids: rows.map((row) => row.id),
    provider_ids: providerIds,
    service_type_values: Array.from(new Set(rows.map((row) => row.service_type))),
    service_mode_values: Array.from(new Set(rows.map((row) => row.service_mode ?? 'home_visit'))),
    active_count: rows.filter((row) => row.is_active).length,
    inactive_count: rows.filter((row) => !row.is_active).length,
  };
}

async function fetchProviderServices(admin, maxRows) {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];

  while (rows.length < maxRows) {
    const upper = Math.min(offset + pageSize - 1, maxRows - 1);
    const { data, error } = await admin
      .from('provider_services')
      .select('id, provider_id, service_type, service_mode, is_active, base_price, service_duration_minutes, created_at, updated_at')
      .order('created_at', { ascending: true })
      .range(offset, upper);

    if (error) {
      throw error;
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
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

  console.log('Service catalog sync-risk audit started');
  console.log(`- max rows: ${args.maxRows}`);

  const startedAt = Date.now();
  const allRows = await fetchProviderServices(admin, args.maxRows);
  const durationMs = Date.now() - startedAt;

  const templateRows = allRows.filter((row) => row.provider_id == null);
  const providerRows = allRows.filter((row) => row.provider_id != null);

  const templateGroups = new Map();
  const providerGroups = new Map();

  for (const row of templateRows) {
    const key = buildGroupKeyForTemplate(row);
    const existing = templateGroups.get(key) || [];
    existing.push(row);
    templateGroups.set(key, existing);
  }

  for (const row of providerRows) {
    const key = buildGroupKeyForProvider(row);
    const existing = providerGroups.get(key) || [];
    existing.push(row);
    providerGroups.set(key, existing);
  }

  const duplicateTemplateGroups = Array.from(templateGroups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => buildGroupSummary(key, rows))
    .sort((a, b) => b.row_count - a.row_count);

  const duplicateProviderGroups = Array.from(providerGroups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => buildGroupSummary(key, rows))
    .sort((a, b) => b.row_count - a.row_count);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(root, args.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const report = {
    generated_at: now.toISOString(),
    duration_ms: durationMs,
    scanned_row_count: allRows.length,
    max_rows_limit: args.maxRows,
    reached_max_rows_limit: allRows.length >= args.maxRows,
    summary: {
      template_rows: templateRows.length,
      provider_rows: providerRows.length,
      template_unique_keys: templateGroups.size,
      provider_unique_keys: providerGroups.size,
      duplicate_template_groups: duplicateTemplateGroups.length,
      duplicate_template_rows: duplicateTemplateGroups.reduce((acc, item) => acc + item.row_count, 0),
      duplicate_provider_groups: duplicateProviderGroups.length,
      duplicate_provider_rows: duplicateProviderGroups.reduce((acc, item) => acc + item.row_count, 0),
    },
    duplicate_template_groups: duplicateTemplateGroups,
    duplicate_provider_groups: duplicateProviderGroups,
    samples: {
      duplicate_template_groups: duplicateTemplateGroups.slice(0, args.sampleSize),
      duplicate_provider_groups: duplicateProviderGroups.slice(0, args.sampleSize),
    },
  };

  const reportPath = path.join(outputDir, `service-catalog-sync-risk-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Audit completed in ${durationMs}ms`);
  console.log(`- scanned rows: ${allRows.length}`);
  console.log(`- template duplicate groups: ${report.summary.duplicate_template_groups}`);
  console.log(`- provider duplicate groups: ${report.summary.duplicate_provider_groups}`);
  console.log(`- report: ${path.relative(root, reportPath)}`);

  if (report.reached_max_rows_limit) {
    console.log('WARN: reached max rows limit; rerun with a higher --max-rows value for full coverage.');
  }

  if (args.failOnRisk && (report.summary.duplicate_template_groups > 0 || report.summary.duplicate_provider_groups > 0)) {
    console.error('FAIL: duplicate-risk groups detected.');
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(`FAIL: audit crashed :: ${error?.message ?? error}`);
  process.exit(1);
});
