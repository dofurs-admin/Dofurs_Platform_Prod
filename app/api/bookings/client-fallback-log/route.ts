import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

const bodySchema = z.object({
  flow: z.enum(['premium-booking']).default('premium-booking'),
  fallbackSource: z.enum(['availability', 'service_type']),
  providerServiceId: z.string().trim().optional(),
  providerId: z.number().int().positive().optional(),
  selectedServiceType: z.string().trim().max(120).optional(),
  selectedPetCount: z.number().int().min(0).max(20).optional(),
  totalSelectedServices: z.number().int().min(0).max(200).optional(),
});

export async function POST(request: Request) {
  const { user, role } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid telemetry payload' }, { status: 400 });
  }

  const payload = parsed.data;

  logSecurityEvent('warn', 'booking.client_service_fallback', {
    route: '/api/bookings/client-fallback-log',
    actorId: user.id,
    actorRole: role,
    message: 'Client fallback service resolution used in booking flow',
    metadata: {
      flow: payload.flow,
      fallbackSource: payload.fallbackSource,
      providerServiceId: payload.providerServiceId ?? null,
      providerId: payload.providerId ?? null,
      selectedServiceType: payload.selectedServiceType ?? null,
      selectedPetCount: payload.selectedPetCount ?? null,
      totalSelectedServices: payload.totalSelectedServices ?? null,
    },
  });

  return NextResponse.json({ success: true }, { status: 202 });
}
