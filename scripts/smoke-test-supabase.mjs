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

async function run() {
  const root = process.cwd();
  const envPath = path.join(root, '.env.local');

  if (!fs.existsSync(envPath)) {
    console.error('FAIL: .env.local not found');
    process.exit(1);
  }

  const env = parseEnvLocal(envPath);
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter((k) => !env[k] || env[k] === '');
  if (missing.length > 0) {
    console.error(`FAIL: Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const checks = [];

  const tables = ['roles', 'users', 'pets', 'providers', 'services', 'bookings', 'provider_blocks'];
  for (const table of tables) {
    const { error } = await admin.from(table).select('*', { count: 'exact', head: true });
    checks.push({
      name: `table_access:${table}`,
      pass: !error,
      detail: error?.message ?? 'ok',
    });
  }

  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  const bucketNames = (buckets ?? []).map((bucket) => bucket.name);
  checks.push({
    name: 'storage_buckets_exist',
    pass: !bucketError && bucketNames.includes('user-photos') && bucketNames.includes('pet-photos'),
    detail: bucketError?.message ?? `found=[${bucketNames.join(', ')}]`,
  });

  const { error: rpcError } = await admin.rpc('create_booking', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_pet_id: 1,
    p_service_id: 1,
    p_booking_start: new Date().toISOString(),
    p_payment_mode: 'online',
    p_amount: 0,
  });

  checks.push({
    name: 'rpc_create_booking_exists',
    pass:
      !!rpcError &&
      !rpcError.message.toLowerCase().includes('function') &&
      !rpcError.message.toLowerCase().includes('does not exist'),
    detail: rpcError?.message ?? 'unexpected success',
  });

  const { data: anonRolesData, error: anonRolesError } = await anon.from('roles').select('id').limit(1);
  checks.push({
    name: 'rls_prevents_anon_role_disclosure',
    pass: !!anonRolesError || (Array.isArray(anonRolesData) && anonRolesData.length === 0),
    detail: anonRolesError?.message ?? `rows_returned=${Array.isArray(anonRolesData) ? anonRolesData.length : 0}`,
  });

  const failures = checks.filter((check) => !check.pass);

  console.log('Supabase smoke test results:');
  for (const check of checks) {
    console.log(`- ${check.pass ? 'PASS' : 'FAIL'} ${check.name} :: ${check.detail}`);
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('FAIL: smoke test crashed:', error?.message ?? error);
  process.exit(1);
});
