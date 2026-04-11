import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { processRazorpayWebhook } from '@/lib/payments/webhookHandler';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  try {
    const supabase = getSupabaseAdminClient();
    const result = await processRazorpayWebhook(supabase, rawBody, signature);
    return NextResponse.json(result, { status: result.accepted ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        accepted: false,
        message: error instanceof Error ? error.message : 'Webhook processing failed.',
      },
      { status: 500 },
    );
  }
}
