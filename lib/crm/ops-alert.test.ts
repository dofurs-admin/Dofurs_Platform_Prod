import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendCrmOpsAlert } from './ops-alert';

function lastFetchCall(fetchSpy: ReturnType<typeof vi.spyOn>) {
  const [url, init] = (fetchSpy.mock.calls.at(-1) ?? []) as [string, RequestInit | undefined];
  return { url, init };
}

function lastPayload(fetchSpy: ReturnType<typeof vi.spyOn>) {
  const { init } = lastFetchCall(fetchSpy);
  return JSON.parse(String(init?.body ?? '{}')) as {
    username?: string;
    embeds: Array<{ title: string; color: number }>;
  };
}

describe('sendCrmOpsAlert', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DISCORD_CRM_ALERTS_ENABLED;
    delete process.env.DISCORD_CRM_WEBHOOK_URL;
    delete process.env.DISCORD_BOOKING_WEBHOOK_URL;
  });

  it('returns not_configured when neither CRM nor booking webhook is set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    const result = await sendCrmOpsAlert({ title: 'New CRM lead', message: 'lead created' });

    expect(result).toEqual({ sent: false, reason: 'not_configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to the CRM webhook when DISCORD_CRM_WEBHOOK_URL is set, ignoring the booking webhook', async () => {
    process.env.DISCORD_CRM_WEBHOOK_URL = 'https://discord.com/api/webhooks/crm/token';
    process.env.DISCORD_BOOKING_WEBHOOK_URL = 'https://discord.com/api/webhooks/booking/token';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    const result = await sendCrmOpsAlert({ title: 'New CRM lead', message: 'lead created', level: 'info' });

    expect(result).toEqual({ sent: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/crm/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/booking/token',
      expect.anything(),
    );

    const payload = lastPayload(fetchSpy);
    expect(payload.username).toBe('Dofurs CRM');
    expect(payload.embeds[0].title).toBe('New CRM lead');
  });

  it('falls back to the booking webhook with a console.warn when the CRM webhook is not configured', async () => {
    process.env.DISCORD_BOOKING_WEBHOOK_URL = 'https://discord.com/api/webhooks/booking/token';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    const result = await sendCrmOpsAlert({ title: 'Hot lead flagged', message: 'hot', level: 'warning' });

    expect(result).toEqual({ sent: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/booking/token',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('DISCORD_CRM_WEBHOOK_URL is not configured'),
    );
  });

  it('sends nothing when DISCORD_CRM_ALERTS_ENABLED is false', async () => {
    process.env.DISCORD_CRM_ALERTS_ENABLED = 'false';
    process.env.DISCORD_CRM_WEBHOOK_URL = 'https://discord.com/api/webhooks/crm/token';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    const result = await sendCrmOpsAlert({ title: 'New CRM lead', message: 'lead created' });

    expect(result).toEqual({ sent: false, reason: 'disabled' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports http failure as not sent', async () => {
    process.env.DISCORD_CRM_WEBHOOK_URL = 'https://discord.com/api/webhooks/crm/token';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    const result = await sendCrmOpsAlert({ title: 'New CRM lead', message: 'lead created' });

    expect(result).toEqual({ sent: false, reason: 'http_500' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});