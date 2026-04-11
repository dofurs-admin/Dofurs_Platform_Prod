import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

const querySchema = z.object({
  providerId: z.coerce.number().int().positive(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(14).optional(),
});

type CalendarAvailabilityRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

type CalendarBookingRow = {
  id: number;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_mode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type: string | null;
  provider_booking_completion_tasks:
    | Array<{ task_status: 'pending' | 'completed' | null }>
    | { task_status: 'pending' | 'completed' | null }
    | null;
};

type CalendarDayPayload = {
  date: string;
  day_of_week: number;
  availability: Array<{
    id: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
  }>;
  bookings: Array<{
    id: number;
    start_time: string | null;
    end_time: string | null;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    booking_mode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
    service_type: string | null;
    completion_task_status: 'pending' | 'completed' | null;
  }>;
};

type CalendarApiPayload = {
  provider: {
    id: number;
    name: string;
  };
  fromDate: string;
  toDate: string;
  days: CalendarDayPayload[];
};

type CalendarMemoryCacheEntry = {
  expiresAt: number;
  payload: CalendarApiPayload;
};

const CALENDAR_MEMORY_CACHE_TTL_MS = 20_000;
const CALENDAR_MEMORY_CACHE_MAX_ENTRIES = 120;
const calendarMemoryCache = new Map<string, CalendarMemoryCacheEntry>();

function addDays(baseDate: Date, days: number) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function calendarCacheHeaders(memoryCacheStatus: 'HIT' | 'MISS') {
  return {
    'Cache-Control': 'private, max-age=20, stale-while-revalidate=40',
    Vary: 'Cookie',
    'X-Admin-Calendar-Cache': memoryCacheStatus,
  } as const;
}

function buildCalendarCacheKey(providerId: number, fromDate: string, toDate: string, rangeDays: number) {
  return `${providerId}:${fromDate}:${toDate}:${rangeDays}`;
}

function getMemoryCachedCalendar(key: string) {
  const entry = calendarMemoryCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    calendarMemoryCache.delete(key);
    return null;
  }

  calendarMemoryCache.delete(key);
  calendarMemoryCache.set(key, entry);
  return entry.payload;
}

function setMemoryCachedCalendar(key: string, payload: CalendarApiPayload) {
  calendarMemoryCache.set(key, {
    expiresAt: Date.now() + CALENDAR_MEMORY_CACHE_TTL_MS,
    payload,
  });

  while (calendarMemoryCache.size > CALENDAR_MEMORY_CACHE_MAX_ENTRIES) {
    const oldestKey = calendarMemoryCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    calendarMemoryCache.delete(oldestKey);
  }
}

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;

  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    providerId: searchParams.get('providerId') ?? undefined,
    fromDate: searchParams.get('fromDate') ?? undefined,
    days: searchParams.get('days') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const { providerId } = parsed.data;
  const rangeDays = parsed.data.days ?? 7;
  const startDate = parsed.data.fromDate ? new Date(`${parsed.data.fromDate}T00:00:00`) : new Date();

  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'Invalid fromDate format' }, { status: 400 });
  }

  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = addDays(normalizedStart, rangeDays - 1);
  const fromDate = toIsoDate(normalizedStart);
  const toDate = toIsoDate(normalizedEnd);
  const cacheKey = buildCalendarCacheKey(providerId, fromDate, toDate, rangeDays);

  const memoryCachedPayload = getMemoryCachedCalendar(cacheKey);

  if (memoryCachedPayload) {
    return NextResponse.json(memoryCachedPayload, {
      headers: calendarCacheHeaders('HIT'),
    });
  }

  try {
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name')
      .eq('id', providerId)
      .single<{ id: number; name: string }>();

    if (providerError || !provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    const [availabilityResult, bookingsResult] = await Promise.all([
      supabase
        .from('provider_availability')
        .select('id, day_of_week, start_time, end_time, is_available')
        .eq('provider_id', providerId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })
        .returns<CalendarAvailabilityRow[]>(),
      supabase
        .from('bookings')
        .select(
          'id, booking_date, start_time, end_time, booking_status, status, booking_mode, service_type, provider_booking_completion_tasks(task_status)',
        )
        .eq('provider_id', providerId)
        .gte('booking_date', fromDate)
        .lte('booking_date', toDate)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true })
        .returns<CalendarBookingRow[]>(),
    ]);

    if (availabilityResult.error) {
      throw availabilityResult.error;
    }

    if (bookingsResult.error) {
      throw bookingsResult.error;
    }

    const availabilityByDay = new Map<number, CalendarAvailabilityRow[]>();

    for (const row of availabilityResult.data ?? []) {
      const current = availabilityByDay.get(row.day_of_week) ?? [];
      current.push(row);
      availabilityByDay.set(row.day_of_week, current);
    }

    const bookingsByDate = new Map<string, CalendarBookingRow[]>();

    for (const row of bookingsResult.data ?? []) {
      if (!row.booking_date) {
        continue;
      }

      const current = bookingsByDate.get(row.booking_date) ?? [];
      current.push(row);
      bookingsByDate.set(row.booking_date, current);
    }

    const days = Array.from({ length: rangeDays }, (_, index) => {
      const dayDate = addDays(normalizedStart, index);
      const isoDate = toIsoDate(dayDate);
      const dayOfWeek = dayDate.getDay();

      return {
        date: isoDate,
        day_of_week: dayOfWeek,
        availability: (availabilityByDay.get(dayOfWeek) ?? []).map((slot) => ({
          id: slot.id,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: slot.is_available,
        })),
        bookings: (bookingsByDate.get(isoDate) ?? []).map((booking) => {
          const completionTaskData = Array.isArray(booking.provider_booking_completion_tasks)
            ? booking.provider_booking_completion_tasks[0]
            : booking.provider_booking_completion_tasks;

          return {
            id: booking.id,
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: booking.booking_status ?? booking.status,
            booking_mode: booking.booking_mode,
            service_type: booking.service_type,
            completion_task_status: completionTaskData?.task_status ?? null,
          };
        }),
      };
    });

    const payload: CalendarApiPayload = {
      provider,
      fromDate,
      toDate,
      days,
    };

    setMemoryCachedCalendar(cacheKey, payload);

    return NextResponse.json(payload, {
      headers: calendarCacheHeaders('MISS'),
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load provider calendar');

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/providers/calendar',
      actorId: user.id,
      actorRole: role,
      targetId: providerId,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        fromDate,
        toDate,
        days: rangeDays,
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
