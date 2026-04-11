import { NextResponse } from 'next/server';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';

type SchemaHealthCheck = {
  key: string;
  ok: boolean;
  expected: boolean;
  actual: boolean;
};

type SchemaHealthResult = {
  healthy: boolean;
  domain: string;
  checks: SchemaHealthCheck[];
  failed_checks?: SchemaHealthCheck[];
  summary?: {
    total: number;
    passed: number;
    failed: number;
  };
  generated_at: string;
  error?: string;
};

export async function GET() {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth.context;

  const { data, error } = await supabase.rpc('get_platform_schema_health');

  if (error) {
    const syntheticFailedCheck: SchemaHealthCheck = {
      key: 'rpc.get_platform_schema_health.available',
      ok: false,
      expected: true,
      actual: false,
    };

    return NextResponse.json(
      {
        healthy: false,
        domain: 'schema-contract',
        checks: [syntheticFailedCheck],
        failed_checks: [syntheticFailedCheck],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
        generated_at: new Date().toISOString(),
        error: `Health check RPC failed: ${error.message}. Ensure schema health migrations are applied, then retry.`,
      },
      { status: 200 },
    );
  }

  const result = (data ?? null) as SchemaHealthResult | null;

  if (!result || !Array.isArray(result.checks)) {
    const syntheticFailedCheck: SchemaHealthCheck = {
      key: 'rpc.get_platform_schema_health.response_shape.valid',
      ok: false,
      expected: true,
      actual: false,
    };

    return NextResponse.json(
      {
        healthy: false,
        domain: 'schema-contract',
        checks: [syntheticFailedCheck],
        failed_checks: [syntheticFailedCheck],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
        },
        generated_at: new Date().toISOString(),
        error: 'Invalid health check response shape from database',
      },
      { status: 200 },
    );
  }

  const failedChecks = result.checks.filter((check) => !check.ok);

  return NextResponse.json(
    {
      ...result,
      failed_checks: failedChecks,
      summary: {
        total: result.checks.length,
        passed: result.checks.length - failedChecks.length,
        failed: failedChecks.length,
      },
    },
    { status: 200 },
  );
}
