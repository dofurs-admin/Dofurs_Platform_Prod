import { NextResponse } from 'next/server';
import { getApiAuthContext, unauthorized } from '@/lib/auth/api-auth';
import { getReminderPreferences, getUpcomingVaccinations } from '@/lib/pets/service';

export async function GET(request: Request) {
  const { user, supabase } = await getApiAuthContext();

  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const daysAheadParam = searchParams.get('daysAhead');

  try {
    const preferences = await getReminderPreferences(supabase, user.id);
    const daysAheadRaw = Number(daysAheadParam ?? preferences.days_ahead);
    const daysAhead = Number.isFinite(daysAheadRaw) ? Math.max(1, Math.min(90, Math.floor(daysAheadRaw))) : 7;

    const reminders = await getUpcomingVaccinations(supabase, user.id, daysAhead);
    return NextResponse.json({
      reminders,
      daysAhead,
      channels: {
        inAppEnabled: preferences.in_app_enabled,
        emailEnabled: preferences.email_enabled,
        whatsappEnabled: preferences.whatsapp_enabled,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load reminders';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
