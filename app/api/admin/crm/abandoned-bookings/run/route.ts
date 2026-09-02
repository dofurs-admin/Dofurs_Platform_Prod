import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { CrmServiceError, runAbandonedBookingSweep } from '@/lib/crm/service';

function safeTokenEqual(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function extractToken(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const tokenHeader = request.headers.get('x-crm-import-token');
  if (typeof tokenHeader === 'string' && tokenHeader.trim().length > 0) {
    return tokenHeader.trim();
  }

  return '';
}

const runSchema = z.object({
  dryRun: z.boolean().default(false),
});

/**
 * POST /api/admin/crm/abandoned-bookings/run
 *
 * Converts stale booking sessions (30+ min without completion) into hot CRM
 * leads. Called by cron with CRM_SHEET_IMPORT_SECRET or manually by admin/staff.
 */
export async function POST(request: Request) {
  const automationSecret = process.env.CRM_SHEET_IMPORT_SECRET?.trim() ?? '';
  const token = extractToken(request);
  const isAutomation = !!automationSecret && !!token && safeTokenEqual(automationSecret, token);

  if (!isAutomation) {
    const auth = await requireApiRole(ADMIN_ROLES);
    if (auth.response) return auth.response;
  }

  const parsed = runSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid sweep payload' }, { status: 400 });
  }

  try {
    const result = await runAbandonedBookingSweep(getSupabaseAdminClient(), {
      triggerSource: isAutomation ? 'cron' : 'admin_panel',
      dryRun: parsed.data.dryRun,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 });
  }
}
