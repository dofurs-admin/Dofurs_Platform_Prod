import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDiscordBookingAlertDedupeForTests, sendDiscordBookingOpsAlert } from './discord';

const bookingRow = {
  id: 77,
  user_id: 'user-1234567890',
  provider_id: 10,
  pet_id: 20,
  service_type: 'full_grooming',
  provider_service_id: 'svc_1',
  booking_date: '2026-05-29',
  start_time: '11:00',
  end_time: '12:30',
  booking_mode: 'home_visit',
  booking_status: 'pending',
  status: 'pending',
  payment_mode: 'direct_to_provider',
  final_price: 1500,
  amount: 1500,
  price_at_booking: 1500,
  discount_amount: 0,
  location_address: 'Flat 101, 12 Foo Street, Indiranagar, Bengaluru, Karnataka 560038',
  users: { name: 'Asha Rao', email: 'asha@example.com', phone: '+91 98765 43210' },
  pets: { name: 'Milo', breed: 'Golden Retriever', size_category: 'Large' },
  providers: { name: 'Dofurs Groomer', business_name: 'Happy Paws Grooming' },
};

function createSupabaseMock(row = bookingRow) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };

  return {
    supabase: {
      from: vi.fn().mockReturnValue(query),
    },
    query,
  };
}

function lastDiscordPayload(fetchSpy: ReturnType<typeof vi.spyOn>) {
  const init = fetchSpy.mock.calls.at(-1)?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? '{}')) as {
    content?: string;
    allowed_mentions?: { roles?: string[] };
    embeds: Array<{ fields: Array<{ name: string; value: string }> }>;
  };
}

function fieldsByName(payload: ReturnType<typeof lastDiscordPayload>) {
  return new Map(payload.embeds[0].fields.map((field) => [field.name, field.value]));
}

describe('sendDiscordBookingOpsAlert', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearDiscordBookingAlertDedupeForTests();
    delete process.env.DISCORD_BOOKING_ALERTS_ENABLED;
    delete process.env.DISCORD_BOOKING_WEBHOOK_URL;
    delete process.env.DISCORD_BOOKING_MENTION;
    delete process.env.DISCORD_BOOKING_INCLUDE_ADDRESS;
    delete process.env.DISCORD_BOOKING_INCLUDE_CUSTOMER_PHONE;
    delete process.env.DISCORD_BOOKING_TIMEOUT_MS;
  });

  it('does not call Discord when no booking webhook is configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const { supabase } = createSupabaseMock();

    const result = await sendDiscordBookingOpsAlert(supabase as never, {
      event: 'booking_created',
      bookingId: 77,
    });

    expect(result).toEqual({ sent: false, reason: 'disabled' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a Discord embed with role mention and masked customer details by default', async () => {
    process.env.DISCORD_BOOKING_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/token';
    process.env.DISCORD_BOOKING_MENTION = '<@&987654321>';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const { supabase } = createSupabaseMock();

    const result = await sendDiscordBookingOpsAlert(supabase as never, {
      event: 'booking_created',
      bookingId: 77,
    });

    expect(result).toEqual({ sent: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/123/token',
      expect.objectContaining({ method: 'POST' }),
    );

    const payload = lastDiscordPayload(fetchSpy);
    const fields = fieldsByName(payload);

    expect(payload.content).toContain('<@&987654321>');
    expect(payload.allowed_mentions?.roles).toEqual(['987654321']);
    expect(fields.get('Customer')).toBe('Asha Rao | xxxxxx3210');
    expect(fields.get('Area')).toBe('Indiranagar, 560038');
    expect(fields.get('Area')).not.toContain('Flat 101');
  });

  it('can include full phone and address when explicitly enabled', async () => {
    process.env.DISCORD_BOOKING_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/token';
    process.env.DISCORD_BOOKING_INCLUDE_ADDRESS = 'true';
    process.env.DISCORD_BOOKING_INCLUDE_CUSTOMER_PHONE = 'true';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const { supabase } = createSupabaseMock();

    const result = await sendDiscordBookingOpsAlert(supabase as never, {
      event: 'booking_payment_collected',
      bookingId: 78,
      amountInr: 1500,
      collectionMode: 'upi',
      changedBy: 'admin',
      transactionId: 'tx_123',
    });

    expect(result).toEqual({ sent: true });

    const payload = lastDiscordPayload(fetchSpy);
    const fields = fieldsByName(payload);

    expect(fields.get('Customer')).toBe('Asha Rao | +91 98765 43210');
    expect(fields.get('Area')).toContain('Flat 101');
    expect(fields.get('Payment')).toBe('Upi Collection | Rs.1,500');
    expect(fields.get('Transaction')).toBe('#tx_123');
  });
});