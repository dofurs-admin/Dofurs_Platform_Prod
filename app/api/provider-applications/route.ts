import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceProviderApplication } from '@/lib/provider-applications/service';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { isValidIndianE164, toIndianE164 } from '@/lib/utils/india-phone';
import { isRateLimited } from '@/lib/api/rate-limit';

const providerApplicationSchema = z.object({
  partner_category: z.enum(['individual', 'business']),
  business_name: z.string().trim().max(120).optional().or(z.literal('')),
  team_size: z.coerce.number().int().min(1).max(500).optional().or(z.literal('')).or(z.null()),
  full_name: z.string().trim().min(2).max(120).regex(/^[a-zA-Z\s.]+$/, 'Name can only contain letters, spaces, and periods'),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  phone_number: z.string().trim().min(10).max(20),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  provider_type: z.string().trim().min(2).max(120),
  years_of_experience: z.coerce.number().int().min(0).max(60),
  service_modes: z.array(z.string().trim().min(2).max(60)).min(1).max(4),
  service_areas: z.string().trim().min(6).max(600),
  portfolio_url: z
    .string()
    .trim()
    .max(2000)
    .url()
    .optional()
    .or(z.literal('')),
  motivation: z.string().trim().max(1200).optional().or(z.literal('')),
  website: z.string().optional(),
});

export async function POST(request: Request) {
  // Rate limit by IP to prevent spam — 5 applications per minute
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = isRateLimited(`provider-application:${clientIp}`, { windowMs: 60_000, maxRequests: 5 });
  if (rate.limited) {
    return NextResponse.json({ error: 'Too many submissions. Please try again shortly.' }, { status: 429 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = providerApplicationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid provider application payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const formData = parsed.data;
  const normalizedPhone = toIndianE164(formData.phone_number);

  if (!isValidIndianE164(normalizedPhone)) {
    return NextResponse.json(
      {
        error: 'Phone number must be a valid Indian number (+91XXXXXXXXXX).',
        details: {
          fieldErrors: {
            phone_number: ['Phone number must be a valid Indian number (+91XXXXXXXXXX).'],
          },
          formErrors: [],
        },
      },
      { status: 400 },
    );
  }

  // Honeypot field to reduce bot submissions.
  if (formData.website && formData.website.trim().length > 0) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await createServiceProviderApplication(supabase, {
      submitted_by_user_id: user?.id ?? null,
      partner_category: formData.partner_category,
      business_name: formData.business_name?.trim() || null,
      team_size: formData.team_size ? Number(formData.team_size) : null,
      full_name: formData.full_name,
      email: formData.email,
      phone_number: normalizedPhone,
      city: formData.city,
      state: formData.state,
      provider_type: formData.provider_type,
      years_of_experience: formData.years_of_experience,
      service_modes: formData.service_modes,
      service_areas: formData.service_areas,
      portfolio_url: formData.portfolio_url?.trim() ? formData.portfolio_url.trim() : null,
      motivation: formData.motivation?.trim() ? formData.motivation.trim() : null,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit provider application' },
      { status: 500 },
    );
  }
}
