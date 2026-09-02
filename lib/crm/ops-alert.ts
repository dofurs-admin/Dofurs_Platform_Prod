// ── CRM ops alerts (Discord) ───────────────────────────────────────────────────
//
// Lightweight, never-throwing ops notifications for CRM background jobs
// (e.g. Meta sheet import failures). Reuses the existing ops Discord webhook
// so alerts land in the channel the team already watches.

const REQUEST_TIMEOUT_MS = 8000;

const EMBED_COLORS: Record<'info' | 'warning' | 'error', number> = {
  info: 0x3b82f6,
  warning: 0xf59e0b,
  error: 0xef4444,
};

export async function sendCrmOpsAlert(input: {
  title: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
}): Promise<{ sent: boolean; reason?: string }> {
  if ((process.env.DISCORD_CRM_ALERTS_ENABLED ?? 'true').trim().toLowerCase() === 'false') {
    return { sent: false, reason: 'disabled' };
  }

  const webhookUrl = (process.env.DISCORD_BOOKING_WEBHOOK_URL ?? '').trim();
  if (!webhookUrl) {
    return { sent: false, reason: 'not_configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'Dofurs CRM',
        embeds: [
          {
            title: input.title,
            description: input.message.slice(0, 1000),
            color: EMBED_COLORS[input.level ?? 'info'],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: controller.signal,
    });

    return { sent: response.ok, reason: response.ok ? undefined : `http_${response.status}` };
  } catch {
    return { sent: false, reason: 'error' };
  } finally {
    clearTimeout(timeout);
  }
}
