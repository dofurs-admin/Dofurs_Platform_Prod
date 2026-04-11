import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getReminderPreferences, upsertReminderPreferences } from '@/lib/pets/service';

const reminderPreferencesSchema = z.object({
  daysAhead: z.number().int().min(1).max(90).optional(),
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
});

export async function GET() {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  try {
    const preferences = await getReminderPreferences(supabase, user.id);
    return NextResponse.json({
      preferences: {
        daysAhead: preferences.days_ahead,
        inAppEnabled: preferences.in_app_enabled,
        emailEnabled: preferences.email_enabled,
        whatsappEnabled: preferences.whatsapp_enabled,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load reminder preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  const parsed = reminderPreferencesSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const preferences = await upsertReminderPreferences(supabase, user.id, {
      days_ahead: parsed.data.daysAhead,
      in_app_enabled: parsed.data.inAppEnabled,
      email_enabled: parsed.data.emailEnabled,
      whatsapp_enabled: parsed.data.whatsappEnabled,
    });

    return NextResponse.json({
      success: true,
      preferences: {
        daysAhead: preferences.days_ahead,
        inAppEnabled: preferences.in_app_enabled,
        emailEnabled: preferences.email_enabled,
        whatsappEnabled: preferences.whatsapp_enabled,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save reminder preferences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
