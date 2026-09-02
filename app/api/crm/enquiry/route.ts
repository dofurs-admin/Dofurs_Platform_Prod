import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { isRateLimited } from '@/lib/api/rate-limit';
import { CrmServiceError, createWebsiteEnquiryLead } from '@/lib/crm/service';

// Public website enquiry form (contact page). No authentication — protected by
// IP rate limiting, strict validation, and a honeypot field.

const RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 5,
};

const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional(),
  petInfo: z.string().trim().max(300).optional(),
  area: z.string().trim().max(120).optional(),
  // Honeypot — must stay empty; bots that fill it are silently rejected.
  company: z.string().max(0).optional(),
});

function getRequestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const candidate = forwarded.split(',')[0]?.trim();
  return candidate || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (payload && typeof payload === 'object' && 'company' in payload && String(payload.company ?? '').trim()) {
    // Honeypot filled — pretend success so bots do not retry.
    return NextResponse.json({ success: true }, { status: 201 });
  }

  const parsed = enquirySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  const ip = getRequestIp(request);
  const rate = await isRateLimited(adminClient, `crm:enquiry:${ip}`, RATE_LIMIT);
  if (rate.limited) {
    return NextResponse.json({ error: 'Too many enquiries. Please try again shortly.' }, { status: 429 });
  }

  try {
    await createWebsiteEnquiryLead(adminClient, {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || undefined,
      message: parsed.data.message,
      petInfo: parsed.data.petInfo,
      area: parsed.data.area,
      request,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof CrmServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status === 500 ? 500 : 400 });
    }
    return NextResponse.json({ error: 'Unable to submit the enquiry right now.' }, { status: 500 });
  }
}
