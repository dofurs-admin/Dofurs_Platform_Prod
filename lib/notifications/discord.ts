import type { SupabaseClient } from '@supabase/supabase-js';
import { getISTTimestamp } from '@/lib/utils/date';

export type BookingOpsAlertEvent =
  | 'booking_created'
  | 'booking_status_changed'
  | 'booking_payment_captured'
  | 'booking_payment_collected'
  | 'booking_provider_reassigned';

export type BookingOpsAlertInput = {
  event: BookingOpsAlertEvent;
  bookingId: number;
  previousStatus?: string | null;
  newStatus?: string | null;
  changedBy?: string | null;
  amountInr?: number | null;
  paymentMode?: string | null;
  collectionMode?: string | null;
  transactionId?: string | null;
  previousProviderId?: number | null;
  providerId?: number | null;
  note?: string | null;
};

type DiscordAlertResult = {
  sent: boolean;
  reason?: string;
};

type DiscordField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordWebhookPayload = {
  username: string;
  content?: string;
  allowed_mentions: {
    parse: Array<'everyone'>;
    roles?: string[];
    users?: string[];
  };
  embeds: Array<{
    title: string;
    description?: string;
    url?: string;
    color: number;
    fields: DiscordField[];
    footer: { text: string };
    timestamp: string;
  }>;
};

type DiscordBookingAlertConfig = {
  webhookUrl: string;
  mention: string;
  includeFullAddress: boolean;
  includeFullCustomerPhone: boolean;
  timeoutMs: number;
};

type BookingRelation<T> = T | T[] | null;

type BookingAlertUser = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

type BookingAlertPet = {
  name: string | null;
  breed: string | null;
  size_category?: string | null;
};

type BookingAlertProvider = {
  name: string | null;
  business_name: string | null;
};

type BookingAlertRow = {
  id: number;
  user_id: string;
  provider_id: number;
  pet_id: number;
  service_type: string | null;
  provider_service_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  booking_mode: string | null;
  booking_status: string | null;
  status?: string | null;
  payment_mode: string | null;
  final_price: number | null;
  amount: number | null;
  price_at_booking: number | null;
  discount_amount: number | null;
  location_address: string | null;
  users?: BookingRelation<BookingAlertUser>;
  pets?: BookingRelation<BookingAlertPet>;
  providers?: BookingRelation<BookingAlertProvider>;
};

const ALERT_DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const recentAlertKeys = new Map<string, number>();

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function normalizeWebhookUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function getDiscordBookingAlertConfig(): DiscordBookingAlertConfig | null {
  if (!readBooleanEnv('DISCORD_BOOKING_ALERTS_ENABLED', true)) {
    return null;
  }

  const webhookUrl = normalizeWebhookUrl(process.env.DISCORD_BOOKING_WEBHOOK_URL ?? '');
  if (!webhookUrl) {
    return null;
  }

  return {
    webhookUrl,
    mention: process.env.DISCORD_BOOKING_MENTION?.trim() ?? '',
    includeFullAddress: readBooleanEnv('DISCORD_BOOKING_INCLUDE_ADDRESS', false),
    includeFullCustomerPhone: readBooleanEnv('DISCORD_BOOKING_INCLUDE_CUSTOMER_PHONE', false),
    timeoutMs: Math.max(500, Math.min(10_000, Number(process.env.DISCORD_BOOKING_TIMEOUT_MS ?? '2500') || 2500)),
  };
}

function reserveDedupeKey(key: string) {
  const now = Date.now();

  for (const [existingKey, createdAt] of recentAlertKeys) {
    if (now - createdAt > ALERT_DEDUPE_WINDOW_MS) {
      recentAlertKeys.delete(existingKey);
    }
  }

  const existing = recentAlertKeys.get(key);
  if (existing && now - existing < ALERT_DEDUPE_WINDOW_MS) {
    return false;
  }

  recentAlertKeys.set(key, now);
  return true;
}

function releaseDedupeKey(key: string) {
  recentAlertKeys.delete(key);
}

function buildDedupeKey(input: BookingOpsAlertInput) {
  return [
    input.event,
    input.bookingId,
    input.previousStatus ?? '',
    input.newStatus ?? '',
    input.changedBy ?? '',
    input.transactionId ?? '',
    input.amountInr ?? '',
    input.collectionMode ?? '',
    input.previousProviderId ?? '',
    input.providerId ?? '',
  ].join(':');
}

function firstRelation<T>(value: BookingRelation<T> | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function truncateDiscordValue(value: string, maxLength = 900) {
  const trimmed = compactText(value);
  if (trimmed.length <= maxLength) return trimmed || 'Not available';
  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sentenceCaseLabel(value: string | null | undefined) {
  const normalized = compactText(value).replace(/[_-]+/g, ' ');
  if (!normalized) return 'Not available';
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Rs.0';
  }

  return `Rs.${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(amount))}`;
}

function formatTimeLabel(value: string | null | undefined) {
  const match = compactText(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';

  const hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isFinite(hour)) return '';

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

function formatSchedule(booking: BookingAlertRow) {
  const date = new Date(`${booking.booking_date}T00:00:00+05:30`);
  const dateLabel = Number.isNaN(date.getTime())
    ? booking.booking_date
    : date.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  const start = formatTimeLabel(booking.start_time);
  const end = formatTimeLabel(booking.end_time);
  const timeLabel = start && end ? `${start} - ${end}` : start;
  return [dateLabel, timeLabel].filter(Boolean).join(', ');
}

function maskPhone(phone: string | null | undefined) {
  const normalized = compactText(phone);
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 4) {
    return normalized || null;
  }

  return `xxxxxx${digits.slice(-4)}`;
}

function summarizeAddress(address: string | null | undefined, includeFullAddress: boolean) {
  const normalized = compactText(address);
  if (!normalized) return null;
  if (includeFullAddress) return truncateDiscordValue(normalized);

  const pincode = normalized.match(/\b[1-9]\d{5}\b/)?.[0] ?? null;
  const parts = normalized.split(',').map((part) => compactText(part)).filter(Boolean);
  const excluded = /^(india|karnataka|ka|bengaluru|bangalore|bangalore urban|bengaluru urban|\d{6})$/i;
  const area = [...parts].reverse().find(
    (part) => !excluded.test(part) && !/\b[1-9]\d{5}\b/.test(part) && !/^\d{1,5}\b/.test(part),
  );

  if (area && pincode) return `${area}, ${pincode}`;
  if (area) return area;
  if (pincode) return `Pincode ${pincode}`;
  return 'Address provided';
}

function getAdminBookingUrl(bookingId: number) {
  const template = process.env.DISCORD_BOOKING_ADMIN_URL_TEMPLATE?.trim();
  if (template) {
    return template.replace(/\{bookingId\}/g, String(bookingId));
  }

  const rawBaseUrl = process.env.DISCORD_BOOKING_ADMIN_BASE_URL
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? 'https://dofurs.in';

  let baseUrl = rawBaseUrl.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(baseUrl);
    baseUrl = parsed.toString().replace(/\/+$/, '');
  } catch {
    baseUrl = 'https://dofurs.in';
  }

  return `${baseUrl}/dashboard/admin/bookings`;
}

function getAlertTitle(input: BookingOpsAlertInput) {
  if (input.event === 'booking_created') return 'New booking received';
  if (input.event === 'booking_payment_captured') return 'Online payment captured';
  if (input.event === 'booking_payment_collected') return 'Manual payment collected';
  if (input.event === 'booking_provider_reassigned') return 'Provider reassigned';
  return `Booking ${sentenceCaseLabel(input.newStatus ?? 'status updated')}`;
}

function getAlertColor(input: BookingOpsAlertInput, booking: BookingAlertRow) {
  const status = compactText(input.newStatus ?? booking.booking_status ?? booking.status).toLowerCase();

  if (input.event === 'booking_created') return 0xe39a5d;
  if (input.event === 'booking_payment_captured' || input.event === 'booking_payment_collected') return 0x2f855a;
  if (input.event === 'booking_provider_reassigned') return 0x805ad5;
  if (status === 'cancelled') return 0xc53030;
  if (status === 'completed') return 0x2b6cb0;
  if (status === 'confirmed') return 0x2f855a;
  if (status === 'no_show') return 0x975a16;
  return 0xe39a5d;
}

function getAllowedMentions(mention: string): DiscordWebhookPayload['allowed_mentions'] {
  const roles = Array.from(mention.matchAll(/<@&(\d+)>/g), (match) => match[1]);
  const users = Array.from(mention.matchAll(/<@!?(\d+)>/g), (match) => match[1]);
  const parse: Array<'everyone'> = /(^|\s)@(everyone|here)(\s|$)/.test(mention) ? ['everyone'] : [];

  return {
    parse,
    ...(roles.length > 0 ? { roles } : {}),
    ...(users.length > 0 ? { users } : {}),
  };
}

function pushField(fields: DiscordField[], name: string, value: string | null | undefined, inline = true) {
  const normalized = truncateDiscordValue(value ?? '');
  if (!normalized || normalized === 'Not available') return;
  fields.push({ name, value: normalized, inline });
}

export function buildDiscordBookingWebhookPayload(
  booking: BookingAlertRow,
  input: BookingOpsAlertInput,
  config: Pick<DiscordBookingAlertConfig, 'mention' | 'includeFullAddress' | 'includeFullCustomerPhone'>,
): DiscordWebhookPayload {
  const customer = firstRelation(booking.users);
  const pet = firstRelation(booking.pets);
  const provider = firstRelation(booking.providers);
  const title = getAlertTitle(input);
  const adminUrl = getAdminBookingUrl(booking.id);
  const amount = input.amountInr ?? booking.final_price ?? booking.amount ?? booking.price_at_booking ?? null;
  const status = input.newStatus ?? booking.booking_status ?? booking.status ?? null;
  const paymentMode = input.collectionMode
    ? `${input.collectionMode} collection`
    : input.paymentMode ?? booking.payment_mode ?? null;
  const customerName = customer?.name || customer?.email || `User ${booking.user_id.slice(0, 8)}`;
  const customerPhone = config.includeFullCustomerPhone ? compactText(customer?.phone) : maskPhone(customer?.phone);
  const petLabel = [pet?.name, pet?.breed, pet?.size_category].map(compactText).filter(Boolean).join(' | ');
  const providerLabel = provider?.business_name || provider?.name || `Provider #${input.providerId ?? booking.provider_id}`;
  const addressSummary = summarizeAddress(booking.location_address, config.includeFullAddress);
  const fields: DiscordField[] = [];

  pushField(fields, 'Booking', `#${booking.id}`);
  pushField(fields, 'Service', sentenceCaseLabel(booking.service_type ?? booking.provider_service_id));
  pushField(fields, 'Schedule', formatSchedule(booking));
  pushField(fields, 'Status', sentenceCaseLabel(status));
  pushField(fields, 'Payment', `${sentenceCaseLabel(paymentMode)} | ${formatCurrency(amount)}`);
  pushField(fields, 'Customer', [customerName, customerPhone].filter(Boolean).join(' | '));
  pushField(fields, 'Pet', petLabel || `Pet #${booking.pet_id}`);
  pushField(fields, 'Provider', providerLabel);
  pushField(fields, 'Area', addressSummary);

  if (input.event === 'booking_status_changed') {
    pushField(fields, 'Status change', `${sentenceCaseLabel(input.previousStatus)} -> ${sentenceCaseLabel(input.newStatus)}`);
  }

  if (input.event === 'booking_provider_reassigned') {
    pushField(
      fields,
      'Provider change',
      `#${input.previousProviderId ?? booking.provider_id} -> #${input.providerId ?? booking.provider_id}`,
    );
  }

  pushField(fields, 'Changed by', sentenceCaseLabel(input.changedBy), true);
  pushField(fields, 'Transaction', input.transactionId ? `#${input.transactionId}` : null, true);
  pushField(fields, 'Note', input.note, false);
  pushField(fields, 'Admin dashboard', `[Open booking queue](${adminUrl})`, false);

  return {
    username: 'Dofurs Booking Ops',
    content: config.mention ? `${config.mention} ${title} for booking #${booking.id}` : undefined,
    allowed_mentions: getAllowedMentions(config.mention),
    embeds: [
      {
        title: `${title} #${booking.id}`,
        url: adminUrl,
        color: getAlertColor(input, booking),
        fields,
        footer: { text: 'Dofurs booking operations' },
        timestamp: getISTTimestamp(),
      },
    ],
  };
}

async function loadBookingAlertRow(supabase: SupabaseClient, bookingId: number) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      provider_id,
      pet_id,
      service_type,
      provider_service_id,
      booking_date,
      start_time,
      end_time,
      booking_mode,
      booking_status,
      status,
      payment_mode,
      final_price,
      amount,
      price_at_booking,
      discount_amount,
      location_address,
      users(name, email, phone),
      pets(name, breed, size_category),
      providers(name, business_name)
    `)
    .eq('id', bookingId)
    .maybeSingle<BookingAlertRow>();

  if (error) {
    console.error('[discord-booking-alert] failed to load booking context', { bookingId, error });
    return null;
  }

  return data;
}

async function postDiscordWebhook(config: DiscordBookingAlertConfig, payload: DiscordWebhookPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    return await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendDiscordBookingOpsAlert(
  supabase: SupabaseClient,
  input: BookingOpsAlertInput,
): Promise<DiscordAlertResult> {
  const config = getDiscordBookingAlertConfig();
  if (!config) {
    return { sent: false, reason: 'disabled' };
  }

  const dedupeKey = buildDedupeKey(input);
  if (!reserveDedupeKey(dedupeKey)) {
    return { sent: false, reason: 'duplicate' };
  }

  try {
    const booking = await loadBookingAlertRow(supabase, input.bookingId);
    if (!booking) {
      releaseDedupeKey(dedupeKey);
      return { sent: false, reason: 'booking_not_found' };
    }

    const response = await postDiscordWebhook(config, buildDiscordBookingWebhookPayload(booking, input, config));
    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      releaseDedupeKey(dedupeKey);
      console.error('[discord-booking-alert] webhook failed', {
        bookingId: input.bookingId,
        event: input.event,
        status: response.status,
        responseBody: truncateDiscordValue(responseBody, 300),
      });
      return { sent: false, reason: `http_${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    releaseDedupeKey(dedupeKey);
    console.error('[discord-booking-alert] failed', {
      bookingId: input.bookingId,
      event: input.event,
      error,
    });
    return { sent: false, reason: 'error' };
  }
}

export function clearDiscordBookingAlertDedupeForTests() {
  recentAlertKeys.clear();
}