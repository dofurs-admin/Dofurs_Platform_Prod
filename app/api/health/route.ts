import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export async function GET() {
  const response = {
    status: 'ok' as 'ok' | 'degraded',
    db: 'unknown' as 'unknown' | 'connected' | 'error',
    timestamp: new Date().toISOString(),
  };

  try {
    const supabase = await getSupabaseServerClient();
    // Probe a public-facing table instead of auth-protected user records.
    const { error } = await supabase.from('service_categories').select('id').limit(1);

    if (error) {
      response.status = 'degraded';
      response.db = 'error';
      return NextResponse.json(response, { status: 200 });
    }

    response.db = 'connected';
    return NextResponse.json(response, { status: 200 });
  } catch {
    response.status = 'degraded';
    response.db = 'error';
    return NextResponse.json(response, { status: 200 });
  }
}
