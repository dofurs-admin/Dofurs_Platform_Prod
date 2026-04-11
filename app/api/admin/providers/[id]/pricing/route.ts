import { NextResponse } from 'next/server';
import { forbidden, getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logProviderAdminAuditEvent, updateProviderPricing } from '@/lib/provider-management/service';
import { providerPricingSchema } from '@/lib/provider-management/validation';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { role, user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  if (role !== 'admin' && role !== 'staff') {
    return forbidden();
  }

  const { id } = await context.params;
  const providerId = Number(id);

  if (!Number.isFinite(providerId)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = providerPricingSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const normalizedPricing = parsed.data.map((item) => ({
      id: item.id,
      service_type: item.service_type,
      base_price: item.base_price,
      surge_price: item.surge_price ?? null,
      commission_percentage: item.commission_percentage ?? null,
      service_duration_minutes: item.service_duration_minutes ?? null,
      is_active: item.is_active ?? true,
    }));

    const pricing = await updateProviderPricing(supabase, providerId, normalizedPricing);
    await logProviderAdminAuditEvent(supabase, user.id, providerId, 'provider.pricing_updated', {
      updatedRows: normalizedPricing.length,
    });
    return NextResponse.json({ success: true, pricing });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update provider pricing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
