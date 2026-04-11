import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  filter: z.enum(['all', 'sla', 'high-risk']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

type BookingSearchRow = {
  id: number;
  user_id: string;
  provider_id: number;
  booking_start: string;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  booking_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | null;
  booking_mode: 'home_visit' | 'clinic_visit' | 'teleconsult' | null;
  service_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  provider_name: string | null;
  completion_task_status: 'pending' | 'completed' | null;
  completion_due_at: string | null;
  completion_completed_at: string | null;
};

const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
const BOOKING_MODES = ['home_visit', 'clinic_visit', 'teleconsult'] as const;

type BookingStatus = (typeof BOOKING_STATUSES)[number];
type BookingMode = (typeof BOOKING_MODES)[number];

function normalizeBookingStatus(value: unknown): BookingStatus {
  return BOOKING_STATUSES.includes(value as BookingStatus) ? (value as BookingStatus) : 'pending';
}

function normalizeNullableBookingStatus(value: unknown): BookingStatus | null {
  if (value == null) return null;
  return BOOKING_STATUSES.includes(value as BookingStatus) ? (value as BookingStatus) : null;
}

function normalizeNullableBookingMode(value: unknown): BookingMode | null {
  if (value == null) return null;
  return BOOKING_MODES.includes(value as BookingMode) ? (value as BookingMode) : null;
}

export async function GET(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    filter: url.searchParams.get('filter') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const query = parsed.data.q?.trim() || undefined;
  const filter = parsed.data.filter ?? 'all';
  const limit = parsed.data.limit ?? 200;

  try {
    const { data, error } = await supabase.rpc('admin_search_bookings', {
      p_query: query,
      p_filter: filter,
      p_limit: limit,
    });

    if (!error) {
      return NextResponse.json({ bookings: (data ?? []) as BookingSearchRow[] });
    }

    if (error.code !== '42883') {
      throw error;
    }

    const fallback = await supabase
      .from('bookings')
      .select('id, user_id, provider_id, booking_start, booking_date, start_time, end_time, status, booking_status, booking_mode, service_type, users(name, email, phone), providers(name), provider_booking_completion_tasks(task_status, due_at, completed_at)')
      .order('booking_start', { ascending: false })
      .limit(limit);

    if (fallback.error) {
      throw fallback.error;
    }

    const normalizedQuery = query?.toLowerCase() ?? '';

    const bookings: BookingSearchRow[] = (fallback.data ?? [])
      .map((row) => {
        const userData = (Array.isArray(row.users) ? row.users[0] : row.users) as
          | { name: string | null; email: string | null; phone: string | null }
          | null;
        const providerData = (Array.isArray(row.providers) ? row.providers[0] : row.providers) as { name: string | null } | null;
        const taskData = (
          Array.isArray(row.provider_booking_completion_tasks)
            ? row.provider_booking_completion_tasks[0]
            : row.provider_booking_completion_tasks
        ) as { task_status: 'pending' | 'completed' | null; due_at: string | null; completed_at: string | null } | null;

        return {
          id: row.id,
          user_id: row.user_id,
          provider_id: row.provider_id,
          booking_start: row.booking_start,
          booking_date: row.booking_date,
          start_time: row.start_time,
          end_time: row.end_time,
          status: normalizeBookingStatus(row.status),
          booking_status: normalizeNullableBookingStatus(row.booking_status),
          booking_mode: normalizeNullableBookingMode(row.booking_mode),
          service_type: row.service_type,
          customer_name: userData?.name ?? null,
          customer_email: userData?.email ?? null,
          customer_phone: userData?.phone ?? null,
          provider_name: providerData?.name ?? null,
          completion_task_status: taskData?.task_status ?? null,
          completion_due_at: taskData?.due_at ?? null,
          completion_completed_at: taskData?.completed_at ?? null,
        };
      })
      .filter((booking) => {
        const effectiveStatus = booking.booking_status ?? booking.status;

        if (filter === 'sla' && effectiveStatus !== 'pending') {
          return false;
        }

        if (filter === 'high-risk' && effectiveStatus !== 'cancelled' && effectiveStatus !== 'no_show') {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [
          booking.id.toString(),
          booking.user_id,
          booking.provider_id.toString(),
          booking.customer_name ?? '',
          booking.customer_email ?? '',
          booking.customer_phone ?? '',
          booking.provider_name ?? '',
          booking.service_type ?? '',
          effectiveStatus,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      });

    return NextResponse.json({ bookings });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load admin bookings');

    logSecurityEvent('error', 'admin.action', {
      route: 'api/admin/bookings',
      actorId: user.id,
      actorRole: role,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        action: 'list_admin_bookings',
        q: query,
        filter,
        limit,
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
