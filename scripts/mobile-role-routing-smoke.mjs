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

const REPORT_PREFIX = 'mobile-role-routing-smoke';

function parseArgs(argv) {
  const args = {
    reportPath: null,
    outputDir: 'audit-output',
    baseUrl: process.env.DOFURS_MOBILE_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000',
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

    if (arg === '--base-url') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --base-url');
      }
      args.baseUrl = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  args.baseUrl = args.baseUrl.replace(/\/$/, '');
  return args;
}

function printHelp() {
  console.log('Validate role-aware customer/provider routing expectations across seeded account states.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/mobile-role-routing-smoke.mjs [--report <path>] [--base-url <url>] [--output-dir <dir>]');
  console.log('');
  console.log('Optional password env overrides:');
  console.log(`  ${SHARED_FIXTURE_PASSWORD_ENV}`);
  console.log(`  ${FIXTURE_PASSWORD_ENV_BY_ACCOUNT.customer}`);
  console.log(`  ${FIXTURE_PASSWORD_ENV_BY_ACCOUNT.providerApproved}`);
  console.log(`  ${FIXTURE_PASSWORD_ENV_BY_ACCOUNT.providerPending}`);
  console.log(`  ${FIXTURE_PASSWORD_ENV_BY_ACCOUNT.providerRejected}`);
  console.log(`  ${FIXTURE_PASSWORD_ENV_BY_ACCOUNT.providerSuspended}`);
  console.log(`  ${FIXTURE_PASSWORD_ENV_BY_ACCOUNT.providerBanned}`);
}

function parseEnvLocal(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function resolveLatestFixtureReport(root) {
  const auditDir = path.join(root, 'audit-output');

  if (!fs.existsSync(auditDir)) {
    throw new Error('audit-output does not exist. Run fixture setup first.');
  }

  const candidates = fs
    .readdirSync(auditDir)
    .filter(
      (name) =>
        name.startsWith('mobile-gate1-fixtures-')
        && name.endsWith('.json')
        && !name.endsWith('.secrets.json'),
    )
    .sort();

  if (candidates.length === 0) {
    throw new Error('No fixture report found. Run scripts/setup-mobile-gate1-fixtures.mjs first.');
  }

  return path.join(auditDir, candidates[candidates.length - 1]);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function inferCustomerRoute(roleName) {
  return roleName === 'user' ? '/(tabs)/home' : '/(auth)/sign-in';
}

async function callJson(url, token, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-client-platform': 'ios',
      'x-app-version': 'phase-gate2-role-routing',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  return {
    status: response.status,
    body: parsed,
    raw: text,
  };
}

async function runAccountCheck({ supabaseUrl, anonKey, baseUrl, accountKey, account, accountPassword }) {
  const isInactiveProvider = ['providerPending', 'providerRejected', 'providerSuspended', 'providerBanned'].includes(accountKey);
  const expectedProfileRole = accountKey === 'customer' ? 'user' : 'provider';
  const expectedCustomerRoute = accountKey === 'customer' ? '/(tabs)/home' : '/(auth)/sign-in';
  const expectedProfileStatus = isInactiveProvider ? 403 : 200;
  const expectedProviderDashboardStatus = accountKey === 'providerApproved' ? 200 : 403;

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const signInResult = await anon.auth.signInWithPassword({
    email: account.email,
    password: accountPassword,
  });

  if (signInResult.error || !signInResult.data?.session?.access_token) {
    throw new Error(`${accountKey}: sign-in failed (${signInResult.error?.message ?? 'missing session'})`);
  }

  const accessToken = signInResult.data.session.access_token;

  const profileResult = await callJson(`${baseUrl}/api/user/profile`, accessToken);
  if (profileResult.status !== expectedProfileStatus) {
    throw new Error(`${accountKey}: /api/user/profile expected ${expectedProfileStatus}, got ${profileResult.status}`);
  }

  if (isInactiveProvider) {
    if (profileResult.body?.error !== 'Account suspended') {
      throw new Error(`${accountKey}: expected Account suspended error for blocked provider state`);
    }

    const providerDashboardResult = await callJson(`${baseUrl}/api/provider/dashboard`, accessToken);
    if (providerDashboardResult.status !== expectedProviderDashboardStatus) {
      throw new Error(
        `${accountKey}: expected provider dashboard status ${expectedProviderDashboardStatus}, got ${providerDashboardResult.status}`,
      );
    }

    await anon.auth.signOut({ scope: 'global' }).catch(() => null);

    return {
      account_key: accountKey,
      email: account.email,
      expected_profile_role: null,
      observed_profile_role: null,
      expected_customer_route: '/(auth)/sign-in',
      observed_customer_route: '/(auth)/sign-in',
      expected_provider_dashboard_status: expectedProviderDashboardStatus,
      observed_provider_dashboard_status: providerDashboardResult.status,
      profile_status: profileResult.status,
      profile_error: profileResult.body?.error ?? null,
    };
  }

  if (!profileResult.body?.profile) {
    throw new Error(`${accountKey}: /api/user/profile expected profile payload, got empty body`);
  }

  const profileRole = profileResult.body.profile?.roles?.name ?? null;
  if (profileRole !== expectedProfileRole) {
    throw new Error(`${accountKey}: expected profile role ${expectedProfileRole}, got ${String(profileRole)}`);
  }

  const customerRoute = inferCustomerRoute(profileRole);
  if (customerRoute !== expectedCustomerRoute) {
    throw new Error(`${accountKey}: expected customer route ${expectedCustomerRoute}, got ${customerRoute}`);
  }

  const providerDashboardResult = await callJson(`${baseUrl}/api/provider/dashboard`, accessToken);
  if (providerDashboardResult.status !== expectedProviderDashboardStatus) {
    throw new Error(
      `${accountKey}: expected provider dashboard status ${expectedProviderDashboardStatus}, got ${providerDashboardResult.status}`,
    );
  }

  await anon.auth.signOut({ scope: 'global' }).catch(() => null);

  return {
    account_key: accountKey,
    email: account.email,
    expected_profile_role: expectedProfileRole,
    observed_profile_role: profileRole,
    expected_customer_route: expectedCustomerRoute,
    observed_customer_route: customerRoute,
    expected_provider_dashboard_status: expectedProviderDashboardStatus,
    observed_provider_dashboard_status: providerDashboardResult.status,
  };
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

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const fixtureReportPath = args.reportPath ? path.resolve(root, args.reportPath) : resolveLatestFixtureReport(root);
  const fixtureReport = readJson(fixtureReportPath);
  const { path: fixtureSecretsPath, data: fixtureSecrets } = readFixtureSecretsReport(fixtureReportPath);

  const accounts = fixtureReport?.accounts ?? null;
  const required = [
    'customer',
    'providerApproved',
    'providerPending',
    'providerRejected',
    'providerSuspended',
    'providerBanned',
  ];

  for (const key of required) {
    if (!accounts?.[key]) {
      throw new Error(`Fixture report missing account: ${key}`);
    }
  }

  const checks = [];

  const accountPasswords = Object.fromEntries(
    required.map((accountKey) => [
      accountKey,
      resolveFixtureAccountPassword({
        accountKey,
        shellEnv: process.env,
        fileEnv: envLocal,
        secretsReport: fixtureSecrets,
        secretsReportPath: fixtureSecretsPath,
      }),
    ]),
  );

  for (const key of required) {
    const account = accounts[key];
    console.log(`Checking role-routing expectations for ${key} (${account.email})`);
    const result = await runAccountCheck({
      supabaseUrl,
      anonKey,
      baseUrl: args.baseUrl,
      accountKey: key,
      account,
      accountPassword: accountPasswords[key],
    });
    checks.push(result);
  }

  const output = {
    generated_at: new Date().toISOString(),
    fixture_report_path: fixtureReportPath,
    base_url: args.baseUrl,
    checks,
  };

  const outputDir = path.resolve(root, args.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDir, `${REPORT_PREFIX}-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(output, null, 2));

  console.log('Role-routing smoke checks passed.');
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
