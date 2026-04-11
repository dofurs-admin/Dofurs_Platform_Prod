import crypto from 'node:crypto';

const BASE_URL = (process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY ?? 8));
const DURATION_SECONDS = Math.max(5, Number(process.env.LOAD_TEST_DURATION_SECONDS ?? 30));
const REQUEST_TIMEOUT_MS = Math.max(500, Number(process.env.LOAD_TEST_REQUEST_TIMEOUT_MS ?? 8000));

const BOOKING_BEARER = process.env.LOAD_TEST_BOOKING_BEARER ?? '';
const PAYMENTS_BEARER = process.env.LOAD_TEST_PAYMENTS_BEARER ?? '';
const WEBHOOK_SIGNATURE = process.env.LOAD_TEST_WEBHOOK_SIGNATURE ?? '';

const DEFAULT_BOOKING_PAYLOAD = {
  petId: 1,
  providerId: 1,
  providerServiceId: 1,
  bookingDate: '2099-12-31',
  startTime: '10:00',
  bookingMode: 'home_visit',
  locationAddress: 'Load test synthetic booking address',
  latitude: 12.9716,
  longitude: 77.5946,
  providerNotes: 'load test',
  useSubscriptionCredit: false,
};

const DEFAULT_PAYMENT_ORDER_PAYLOAD = {
  planId: 1,
  amountInr: 1,
  currency: 'INR',
};

const BOOKING_PAYLOAD = process.env.LOAD_TEST_BOOKING_PAYLOAD
  ? JSON.parse(process.env.LOAD_TEST_BOOKING_PAYLOAD)
  : DEFAULT_BOOKING_PAYLOAD;

const PAYMENT_ORDER_PAYLOAD = process.env.LOAD_TEST_PAYMENTS_ORDER_PAYLOAD
  ? JSON.parse(process.env.LOAD_TEST_PAYMENTS_ORDER_PAYLOAD)
  : DEFAULT_PAYMENT_ORDER_PAYLOAD;

const WEBHOOK_BODY = process.env.LOAD_TEST_WEBHOOK_BODY
  ? JSON.parse(process.env.LOAD_TEST_WEBHOOK_BODY)
  : {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: `load_test_${Date.now()}`,
            order_id: 'order_load_test',
            status: 'failed',
            amount: 100,
            currency: 'INR',
          },
        },
      },
    };

const gateThresholds = {
  bookingsCreateP95Ms: Number(process.env.GATE_BOOKINGS_CREATE_P95_MS ?? 1200),
  paymentsOrderP95Ms: Number(process.env.GATE_PAYMENTS_ORDER_P95_MS ?? 1500),
  webhookP95Ms: Number(process.env.GATE_WEBHOOK_P95_MS ?? 1000),
  minSuccessRate: Number(process.env.GATE_MIN_SUCCESS_RATE ?? 0.95),
};

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function isSuccessStatus(status, allowedStatuses) {
  return allowedStatuses.includes(status);
}

async function callEndpoint({ method, path, body, headers = {}, allowedStatuses }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const elapsed = Date.now() - started;
    return {
      ok: isSuccessStatus(response.status, allowedStatuses),
      status: response.status,
      elapsed,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      elapsed: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runScenario(name, requestFactory) {
  const startedAt = Date.now();
  const stopAt = startedAt + DURATION_SECONDS * 1000;
  const latencies = [];
  let total = 0;
  let success = 0;
  const statusCounts = new Map();

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (Date.now() < stopAt) {
      const result = await requestFactory();
      total += 1;
      latencies.push(result.elapsed);
      statusCounts.set(result.status, (statusCounts.get(result.status) ?? 0) + 1);
      if (result.ok) success += 1;
    }
  });

  await Promise.all(workers);

  const successRate = total > 0 ? success / total : 0;
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);

  return {
    name,
    total,
    success,
    successRate,
    p95,
    p99,
    statusCounts: Array.from(statusCounts.entries()).sort((a, b) => a[0] - b[0]),
  };
}

function printScenario(result) {
  console.log(`\\n[${result.name}]`);
  console.log(`- total requests: ${result.total}`);
  console.log(`- success requests: ${result.success}`);
  console.log(`- success rate: ${(result.successRate * 100).toFixed(2)}%`);
  console.log(`- p95 latency: ${result.p95}ms`);
  console.log(`- p99 latency: ${result.p99}ms`);
  console.log(`- status distribution: ${result.statusCounts.map(([s, c]) => `${s}:${c}`).join(', ') || 'none'}`);
}

function ensureConfigured(value, name) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

async function run() {
  console.log('Core flow load test started');
  console.log(`- base url: ${BASE_URL}`);
  console.log(`- concurrency: ${CONCURRENCY}`);
  console.log(`- duration seconds: ${DURATION_SECONDS}`);

  ensureConfigured(BOOKING_BEARER, 'LOAD_TEST_BOOKING_BEARER');
  ensureConfigured(PAYMENTS_BEARER, 'LOAD_TEST_PAYMENTS_BEARER');

  const bookingResult = await runScenario('bookings.create', () =>
    callEndpoint({
      method: 'POST',
      path: '/api/bookings/create',
      body: BOOKING_PAYLOAD,
      headers: {
        authorization: `Bearer ${BOOKING_BEARER}`,
      },
      allowedStatuses: [200, 201, 409, 429],
    }),
  );

  const paymentsResult = await runScenario('payments.subscriptions.order', () =>
    callEndpoint({
      method: 'POST',
      path: '/api/payments/subscriptions/order',
      body: PAYMENT_ORDER_PAYLOAD,
      headers: {
        authorization: `Bearer ${PAYMENTS_BEARER}`,
        'x-idempotency-key': `load-${crypto.randomUUID()}`,
      },
      allowedStatuses: [200, 201, 409, 429],
    }),
  );

  const webhookResult = await runScenario('payments.webhook', () =>
    callEndpoint({
      method: 'POST',
      path: '/api/payments/webhook',
      body: WEBHOOK_BODY,
      headers: WEBHOOK_SIGNATURE
        ? {
            'x-razorpay-signature': WEBHOOK_SIGNATURE,
          }
        : {},
      allowedStatuses: [200, 400, 401, 429],
    }),
  );

  printScenario(bookingResult);
  printScenario(paymentsResult);
  printScenario(webhookResult);

  const gateFailures = [];

  if (bookingResult.successRate < gateThresholds.minSuccessRate) {
    gateFailures.push(
      `bookings.create success rate ${(bookingResult.successRate * 100).toFixed(2)}% < ${(gateThresholds.minSuccessRate * 100).toFixed(2)}%`,
    );
  }
  if (paymentsResult.successRate < gateThresholds.minSuccessRate) {
    gateFailures.push(
      `payments.subscriptions.order success rate ${(paymentsResult.successRate * 100).toFixed(2)}% < ${(gateThresholds.minSuccessRate * 100).toFixed(2)}%`,
    );
  }
  if (webhookResult.successRate < gateThresholds.minSuccessRate) {
    gateFailures.push(
      `payments.webhook success rate ${(webhookResult.successRate * 100).toFixed(2)}% < ${(gateThresholds.minSuccessRate * 100).toFixed(2)}%`,
    );
  }

  if (bookingResult.p95 > gateThresholds.bookingsCreateP95Ms) {
    gateFailures.push(`bookings.create p95 ${bookingResult.p95}ms > ${gateThresholds.bookingsCreateP95Ms}ms`);
  }
  if (paymentsResult.p95 > gateThresholds.paymentsOrderP95Ms) {
    gateFailures.push(`payments.subscriptions.order p95 ${paymentsResult.p95}ms > ${gateThresholds.paymentsOrderP95Ms}ms`);
  }
  if (webhookResult.p95 > gateThresholds.webhookP95Ms) {
    gateFailures.push(`payments.webhook p95 ${webhookResult.p95}ms > ${gateThresholds.webhookP95Ms}ms`);
  }

  if (gateFailures.length > 0) {
    console.error('\\nRelease gate FAILED');
    for (const failure of gateFailures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('\\nRelease gate PASSED');
}

run().catch((error) => {
  console.error(`Load test failed: ${error?.message ?? error}`);
  process.exit(1);
});
