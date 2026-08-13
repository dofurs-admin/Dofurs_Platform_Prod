import fs from 'node:fs';

export const SHARED_FIXTURE_PASSWORD_ENV = 'DOFURS_MOBILE_FIXTURE_PASSWORD';

export const FIXTURE_PASSWORD_ENV_BY_ACCOUNT = Object.freeze({
  customer: 'DOFURS_MOBILE_FIXTURE_PASSWORD_CUSTOMER',
  providerApproved: 'DOFURS_MOBILE_FIXTURE_PASSWORD_PROVIDER_APPROVED',
  providerPending: 'DOFURS_MOBILE_FIXTURE_PASSWORD_PROVIDER_PENDING',
  providerRejected: 'DOFURS_MOBILE_FIXTURE_PASSWORD_PROVIDER_REJECTED',
  providerSuspended: 'DOFURS_MOBILE_FIXTURE_PASSWORD_PROVIDER_SUSPENDED',
  providerBanned: 'DOFURS_MOBILE_FIXTURE_PASSWORD_PROVIDER_BANNED',
});

export function normalizeFixtureSecretValue(rawValue) {
  if (typeof rawValue !== 'string') {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}

export function resolveFixtureSecretsReportPath(fixtureReportPath) {
  if (fixtureReportPath.endsWith('.secrets.json')) {
    return fixtureReportPath;
  }

  if (fixtureReportPath.endsWith('.json')) {
    return fixtureReportPath.slice(0, -'.json'.length) + '.secrets.json';
  }

  return `${fixtureReportPath}.secrets.json`;
}

export function readFixtureSecretsReport(fixtureReportPath) {
  const secretsReportPath = resolveFixtureSecretsReportPath(fixtureReportPath);

  if (!fs.existsSync(secretsReportPath)) {
    return {
      path: secretsReportPath,
      data: null,
    };
  }

  try {
    return {
      path: secretsReportPath,
      data: JSON.parse(fs.readFileSync(secretsReportPath, 'utf8')),
    };
  } catch (error) {
    throw new Error(
      `Failed to parse fixture secrets report ${secretsReportPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function resolveFixtureAccountPassword(options) {
  const {
    accountKey,
    shellEnv = process.env,
    fileEnv = {},
    secretsReport = null,
    secretsReportPath,
  } = options;

  const specificEnvName = FIXTURE_PASSWORD_ENV_BY_ACCOUNT[accountKey];
  if (!specificEnvName) {
    throw new Error(`Unknown fixture account key: ${accountKey}`);
  }

  const fromSpecificEnv = normalizeFixtureSecretValue(shellEnv[specificEnvName] ?? fileEnv[specificEnvName]);
  if (fromSpecificEnv) {
    return fromSpecificEnv;
  }

  const fromSharedEnv = normalizeFixtureSecretValue(
    shellEnv[SHARED_FIXTURE_PASSWORD_ENV] ?? fileEnv[SHARED_FIXTURE_PASSWORD_ENV],
  );
  if (fromSharedEnv) {
    return fromSharedEnv;
  }

  const fromSecretReport = normalizeFixtureSecretValue(secretsReport?.accounts?.[accountKey]?.password);
  if (fromSecretReport) {
    return fromSecretReport;
  }

  const resolvedSecretsPath = secretsReportPath ?? '<fixture-report>.secrets.json';
  throw new Error(
    `Missing fixture password for ${accountKey}. Set ${specificEnvName} (or ${SHARED_FIXTURE_PASSWORD_ENV}) in your shell/.env.local, or regenerate fixture secrets at ${resolvedSecretsPath}.`,
  );
}

export function listFixturePasswordEnvNames(accountKeys) {
  return accountKeys
    .map((accountKey) => FIXTURE_PASSWORD_ENV_BY_ACCOUNT[accountKey])
    .filter((value) => typeof value === 'string');
}