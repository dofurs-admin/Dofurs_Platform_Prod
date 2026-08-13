#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  FIXTURE_PASSWORD_ENV_BY_ACCOUNT,
  SHARED_FIXTURE_PASSWORD_ENV,
  readFixtureSecretsReport,
  resolveFixtureAccountPassword,
} from './mobile-fixture-secrets.mjs';

const DEFAULT_OUTPUT_DIR = 'audit-output';
const REPORT_PREFIX = 'mobile-auth-lifecycle-smoke';

function parseArgs(argv) {
  const args = {
    reportPath: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    if (arg === '--report') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --report');
      }
      args.reportPath = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--report=')) {
      args.reportPath = arg.slice('--report='.length);
      continue;
    }

    if (arg === '--output-dir') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --output-dir');
      }
      args.outputDir = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      args.outputDir = arg.slice('--output-dir='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log('Validate auth-session lifecycle behavior for seeded mobile accounts.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/mobile-auth-lifecycle-smoke.mjs [--report <path>] [--output-dir <dir>]');
  console.log('');
  console.log('Behavior covered:');
  console.log('  - sign in');
  console.log('  - restore session (app restart simulation)');
  console.log('  - refresh session (token refresh simulation)');
  console.log('  - sign out and token revocation checks');
  console.log('');
  console.log('Required env (.env.local or shell):');
  console.log('  NEXT_PUBLIC_SUPABASE_URL');
  console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log('  SUPABASE_SERVICE_ROLE_KEY');
  console.log(`  ${SHARED_FIXTURE_PASSWORD_ENV} (optional shared password override)`);
  console.log(`  ${FIXTURE_PASSWORD_ENV_BY_ACCOUNT.customer} (optional)`);
  console.log(`  ${FIXTURE_PASSWORD_ENV_BY_ACCOUNT.providerApproved} (optional)`);
}

function parseEnvLocal(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const result = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    result[key] = value;
  }

  return result;
}

function resolveLatestFixtureReport(root) {
  const auditDir = path.join(root, 'audit-output');
  if (!fs.existsSync(auditDir)) {
    throw new Error('audit-output directory does not exist. Run fixture setup first.');
  }

  const files = fs
    .readdirSync(auditDir)
    .filter(
      (name) =>
        name.startsWith('mobile-gate1-fixtures-')
        && name.endsWith('.json')
        && !name.endsWith('.secrets.json'),
    )
    .sort();

  if (files.length === 0) {
    throw new Error('No mobile-gate1 fixture report found. Run scripts/setup-mobile-gate1-fixtures.mjs first.');
  }

  return path.join(auditDir, files[files.length - 1]);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read JSON file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createAnonClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function summarizeAuthError(error) {
  const message = String(error?.message || '').trim().toLowerCase();
  if (!message) {
    return 'unknown auth error';
  }
  return message;
}

async function assertTokenValid(adminClient, token, expectedUserId, label) {
  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(token);

  if (error || !user) {
    throw new Error(`${label}: expected token to be valid, got ${error?.message ?? 'missing user'}`);
  }

  if (expectedUserId && user.id !== expectedUserId) {
    throw new Error(`${label}: expected user ${expectedUserId}, got ${user.id}`);
  }
}

async function assertTokenRevoked(adminClient, token, label) {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const {
      data: { user },
      error,
    } = await adminClient.auth.getUser(token);

    if (error || !user) {
      const message = summarizeAuthError(error);
      if (
        message.includes('auth session missing')
        || message.includes('invalid jwt')
        || message.includes('jwt expired')
        || message.includes('session from session_id claim in jwt does not exist')
      ) {
        return;
      }

      return;
    }

    if (attempt < maxAttempts) {
      await delay(250 * attempt);
      continue;
    }
  }

  throw new Error(`${label}: token still valid after sign-out revocation checks`);
}

async function runLifecycleForAccount(input) {
  const { accountKey, account, accountPassword, supabaseUrl, anonKey, adminClient } = input;

  const lifecycle = {
    account_key: accountKey,
    email: account.email,
    auth_user_id: account.authUserId,
    steps: [],
  };

  const client = createAnonClient(supabaseUrl, anonKey);

  const signInResult = await client.auth.signInWithPassword({
    email: account.email,
    password: accountPassword,
  });

  if (signInResult.error || !signInResult.data?.session) {
    throw new Error(`${accountKey}: sign-in failed: ${signInResult.error?.message ?? 'missing session'}`);
  }

  const firstSession = signInResult.data.session;
  const firstAccessToken = firstSession.access_token;
  const firstRefreshToken = firstSession.refresh_token;

  lifecycle.steps.push({
    step: 'sign_in',
    outcome: 'passed',
    session_user_id: firstSession.user?.id ?? null,
  });

  await assertTokenValid(adminClient, firstAccessToken, account.authUserId, `${accountKey}: initial token`);
  lifecycle.steps.push({ step: 'token_valid_after_sign_in', outcome: 'passed' });

  const restartClient = createAnonClient(supabaseUrl, anonKey);
  const restoreResult = await restartClient.auth.setSession({
    access_token: firstAccessToken,
    refresh_token: firstRefreshToken,
  });

  if (restoreResult.error || !restoreResult.data?.session) {
    throw new Error(`${accountKey}: session restore failed: ${restoreResult.error?.message ?? 'missing restored session'}`);
  }

  const restoredSession = restoreResult.data.session;

  if (restoredSession.user?.id !== account.authUserId) {
    throw new Error(`${accountKey}: restored session user mismatch`);
  }

  lifecycle.steps.push({ step: 'session_restore_app_restart_simulation', outcome: 'passed' });

  const refreshResult = await restartClient.auth.refreshSession();
  if (refreshResult.error || !refreshResult.data?.session?.access_token) {
    throw new Error(`${accountKey}: token refresh failed: ${refreshResult.error?.message ?? 'missing refreshed token'}`);
  }

  const refreshedSession = refreshResult.data.session;
  await assertTokenValid(adminClient, refreshedSession.access_token, account.authUserId, `${accountKey}: refreshed token`);
  lifecycle.steps.push({
    step: 'token_refresh_foreground_simulation',
    outcome: 'passed',
    refreshed_user_id: refreshedSession.user?.id ?? null,
  });

  await restartClient.auth.signOut({ scope: 'global' }).catch(() => null);
  await assertTokenRevoked(adminClient, refreshedSession.access_token, `${accountKey}: refreshed token revocation`);
  lifecycle.steps.push({ step: 'token_revocation_after_sign_out', outcome: 'passed' });

  const secondSignIn = await client.auth.signInWithPassword({
    email: account.email,
    password: accountPassword,
  });

  if (secondSignIn.error || !secondSignIn.data?.session?.access_token) {
    throw new Error(`${accountKey}: second sign-in failed: ${secondSignIn.error?.message ?? 'missing session'}`);
  }

  const secondToken = secondSignIn.data.session.access_token;
  await assertTokenValid(adminClient, secondToken, account.authUserId, `${accountKey}: second token`);
  lifecycle.steps.push({ step: 'session_reacquire_after_revocation', outcome: 'passed' });

  await client.auth.signOut({ scope: 'global' }).catch(() => null);
  await assertTokenRevoked(adminClient, secondToken, `${accountKey}: final sign-out revocation`);
  lifecycle.steps.push({ step: 'explicit_sign_out_cleanup', outcome: 'passed' });

  return lifecycle;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const root = process.cwd();
  const envLocal = parseEnvLocal(path.join(root, '.env.local'));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envLocal.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envLocal.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
  }

  const fixtureReportPath = args.reportPath ? path.resolve(root, args.reportPath) : resolveLatestFixtureReport(root);
  const fixtureReport = readJson(fixtureReportPath);
  const { path: fixtureSecretsPath, data: fixtureSecrets } = readFixtureSecretsReport(fixtureReportPath);

  const accounts = fixtureReport?.accounts;
  if (!accounts?.customer || !accounts?.providerApproved) {
    throw new Error('Fixture report missing accounts.customer or accounts.providerApproved');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const targets = {
    customer: accounts.customer,
    providerApproved: accounts.providerApproved,
  };

  const targetPasswords = {
    customer: resolveFixtureAccountPassword({
      accountKey: 'customer',
      shellEnv: process.env,
      fileEnv: envLocal,
      secretsReport: fixtureSecrets,
      secretsReportPath: fixtureSecretsPath,
    }),
    providerApproved: resolveFixtureAccountPassword({
      accountKey: 'providerApproved',
      shellEnv: process.env,
      fileEnv: envLocal,
      secretsReport: fixtureSecrets,
      secretsReportPath: fixtureSecretsPath,
    }),
  };

  const lifecycleResults = [];

  for (const [accountKey, account] of Object.entries(targets)) {
    console.log(`Running lifecycle smoke for ${accountKey} (${account.email})`);
    const result = await runLifecycleForAccount({
      accountKey,
      account,
      accountPassword: targetPasswords[accountKey],
      supabaseUrl,
      anonKey,
      adminClient,
    });
    lifecycleResults.push(result);
  }

  const output = {
    generated_at: new Date().toISOString(),
    fixture_report_path: fixtureReportPath,
    checks: lifecycleResults,
  };

  const outputDir = path.resolve(root, args.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `${REPORT_PREFIX}-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log('Auth lifecycle smoke completed successfully.');
  console.log(`Report: ${outputPath}`);
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
