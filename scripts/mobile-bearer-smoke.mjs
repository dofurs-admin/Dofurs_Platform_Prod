#!/usr/bin/env node

const baseUrl = (process.env.DOFURS_MOBILE_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const token = process.env.DOFURS_MOBILE_BEARER_TOKEN || '';
const platform = process.env.DOFURS_MOBILE_PLATFORM || 'ios';
const appVersion = process.env.DOFURS_MOBILE_APP_VERSION || 'phase0-smoke';

function printHeader(title) {
  console.log('');
  console.log('=== ' + title + ' ===');
}

if (!token) {
  console.error('Missing DOFURS_MOBILE_BEARER_TOKEN.');
  console.error('Set a valid Supabase access token and rerun this script.');
  process.exit(2);
}

const commonHeaders = {
  Authorization: 'Bearer ' + token,
  'x-client-platform': platform,
  'x-app-version': appVersion,
};

function buildRequest(method, path, options = {}) {
  const headers = {
    ...commonHeaders,
    ...(options.headers || {}),
  };

  const request = {
    method,
    headers,
    redirect: 'manual',
  };

  if (options.body !== undefined) {
    request.body = JSON.stringify(options.body);
    request.headers['Content-Type'] = 'application/json';
  }

  return {
    url: baseUrl + path,
    request,
  };
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function executeCheck(name, method, path, options = {}, assertCheck) {
  const { url, request } = buildRequest(method, path, options);
  const response = await fetch(url, request);
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const location = response.headers.get('location');
  const parsedJson = contentType.includes('application/json') ? tryParseJson(text) : null;

  const firstLine = text.split('\n').map((line) => line.trim()).find((line) => line.length > 0) || '<empty>';

  console.log(name + ': ' + response.status + ' ' + response.statusText);
  console.log('  ' + method + ' ' + path);
  console.log('  content-type: ' + (contentType ? contentType.split(';')[0] : '<none>'));

  if (location) {
    console.log('  location: ' + location);
  }

  console.log('  body: ' + firstLine.slice(0, 280));

  let failureReason = null;

  if (response.status >= 300 && response.status < 400) {
    failureReason = 'unexpected redirect response';
  } else if (assertCheck) {
    failureReason = assertCheck({ response, contentType, parsedJson, text });
  }

  return {
    name,
    ok: failureReason === null,
    status: response.status,
    reason: failureReason,
  };
}

async function main() {
  printHeader('Dofurs Mobile Bearer Smoke');
  console.log('Base URL: ' + baseUrl);
  console.log('Platform: ' + platform);
  console.log('App Version: ' + appVersion);

  const checks = [];

  checks.push(
    await executeCheck(
      'Bootstrap profile bearer check',
      'POST',
      '/api/auth/bootstrap-profile',
      {
        headers: {
          'x-idempotency-key': 'phase0-bootstrap-check',
        },
      },
      ({ response, parsedJson, contentType }) => {
        if (response.status !== 200) {
          return 'expected HTTP 200';
        }

        if (!contentType.includes('application/json')) {
          return 'expected application/json response';
        }

        if (!parsedJson || parsedJson.success !== true) {
          return 'expected {"success": true} response payload';
        }

        return null;
      },
    ),
  );

  checks.push(
    await executeCheck(
      'Booking catalog bearer check',
      'GET',
      '/api/bookings/catalog',
      {},
      ({ response, contentType, parsedJson }) => {
        if (response.status !== 200) {
          return 'expected HTTP 200';
        }

        if (!contentType.includes('application/json')) {
          return 'expected application/json response';
        }

        if (!parsedJson || typeof parsedJson !== 'object') {
          return 'expected JSON object response body';
        }

        return null;
      },
    ),
  );

  checks.push(
    await executeCheck(
      'Booking order auth gate check',
      'POST',
      '/api/payments/bookings/order',
      {
        headers: {
          'x-idempotency-key': 'phase0-order-check',
        },
        body: {
          bookingType: 'service',
        },
      },
      ({ response, contentType, parsedJson }) => {
        if (![400, 422].includes(response.status)) {
          return 'expected HTTP 400/422 for intentionally invalid booking payload';
        }

        if (!contentType.includes('application/json')) {
          return 'expected application/json response';
        }

        if (!parsedJson || typeof parsedJson.error !== 'string') {
          return 'expected JSON error payload';
        }

        return null;
      },
    ),
  );

  const failed = checks.filter((check) => !check.ok);

  printHeader('Summary');
  checks.forEach((check) => {
    const statusLine = (check.ok ? 'PASS' : 'FAIL') + ' - ' + check.name + ' (' + check.status + ')';
    console.log(check.reason ? statusLine + ' - ' + check.reason : statusLine);
  });

  if (failed.length > 0) {
    console.error('');
    console.error('Bearer smoke checks failed. Investigate middleware/auth handling for listed endpoints.');
    process.exit(1);
  }

  console.log('');
  console.log('All bearer smoke checks passed (strict status + JSON assertions).');
}

main().catch((error) => {
  console.error('Smoke run failed with exception:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
