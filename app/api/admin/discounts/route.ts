import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logAdminAction } from '@/lib/admin/audit';
import {
  getPlatformDiscountAnalytics,
  listPlatformDiscounts,
  upsertPlatformDiscount,
} from '@/lib/provider-management/service';
import { adminDiscountUpsertSchema } from '@/lib/provider-management/validation';

export async function GET() {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  try {
    const [discounts, analytics] = await Promise.all([
      listPlatformDiscounts(supabase),
      getPlatformDiscountAnalytics(supabase),
    ]);
    return NextResponse.json({ discounts, analytics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load discounts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const payload = await request.json().catch(() => null);
  const parsed = adminDiscountUpsertSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const discount = await upsertPlatformDiscount(supabase, user.id, parsed.data);
    void logAdminAction({ adminUserId: user.id, action: 'discount.upserted', entityType: 'discount', entityId: String(discount.id ?? parsed.data.id ?? 'new'), newValue: { code: discount.code, is_active: discount.is_active }, request });
    return NextResponse.json({ success: true, discount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upsert discount';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
