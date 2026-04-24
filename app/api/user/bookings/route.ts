import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getMyBookings } from '@/lib/bookings/service';
import { toFriendlyApiError } from '@/lib/api/errors';
import { logSecurityEvent } from '@/lib/monitoring/security-log';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import {
  extractProviderServiceIdsFromNotes,
  resolveIncludedServicesForBooking,
} from '@/lib/bookings/included-services';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
});

type ProviderServiceRow = {
  id: string;
  service_type: string | null;
  base_price: number | null;
};

function extractProviderServiceIdsFromPayloadNode(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractProviderServiceIdsFromPayloadNode(entry));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const candidate = (value as { providerServiceId?: unknown; provider_service_id?: unknown }).providerServiceId
    ?? (value as { providerServiceId?: unknown; provider_service_id?: unknown }).provider_service_id;

  if (typeof candidate !== 'string') {
    return [];
  }

  const normalized = candidate.trim();
  return normalized ? [normalized] : [];
}

function extractProviderServiceIdsFromPaymentMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const value = metadata as Record<string, unknown>;

  return [
    ...extractProviderServiceIdsFromPayloadNode(value.booking_payload),
    ...extractProviderServiceIdsFromPayloadNode(value.booking_bundle_payload),
    ...extractProviderServiceIdsFromPayloadNode(value.booking_payloads),
  ];
}

function resolveServiceLabelFromProviderServiceId(
  providerServiceId: string,
  serviceNameByProviderServiceId: ReadonlyMap<string, string>,
) {
  const resolvedName = serviceNameByProviderServiceId.get(providerServiceId)?.trim() ?? '';
  if (resolvedName) {
    return resolvedName;
  }

  return `Service package (${providerServiceId.slice(0, 8)})`;
}

function resolveIncludedServicesFromMetadata(
  providerServiceIds: string[],
  serviceNameByProviderServiceId: ReadonlyMap<string, string>,
) {
  return providerServiceIds.map((providerServiceId) =>
    resolveServiceLabelFromProviderServiceId(providerServiceId, serviceNameByProviderServiceId),
  );
}

export async function GET(request: Request) {
  const auth = await requireApiRole(['user', ...ADMIN_ROLES]);

  if (auth.response) {
    return auth.response;
  }

  const { user, role, supabase } = auth.context;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    userId: url.searchParams.get('userId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const targetUserId = role === 'admin' || role === 'staff' ? parsed.data.userId ?? user.id : user.id;

  try {
    if (targetUserId === user.id) {
      const bookings = await getMyBookings(supabase, targetUserId);
      const admin = getSupabaseAdminClient();
      const bookingIds = bookings.map((booking) => booking.id);
      const providerIds = Array.from(
        new Set(
          bookings
            .map((booking) => Number((booking as { provider_id?: unknown }).provider_id ?? NaN))
            .filter((providerId) => Number.isFinite(providerId) && providerId > 0),
        ),
      );

      let providerNameById = new Map<number, string>();

      if (providerIds.length > 0) {
        const { data: providerRows, error: providerError } = await admin
          .from('providers')
          .select('id, name')
          .in('id', providerIds)
          .returns<Array<{ id: number; name: string | null }>>();

        if (!providerError) {
          providerNameById = new Map(
            (providerRows ?? [])
              .filter((row) => Number.isFinite(row.id) && row.id > 0 && typeof row.name === 'string' && row.name.trim().length > 0)
              .map((row) => [row.id, row.name?.trim() ?? '']),
          );
        }
      }

      let pendingMap = new Map<number, { amountInr: number; status: string }>();

      if (bookingIds.length > 0) {
        const { data: collections } = await admin
          .from('booking_payment_collections')
          .select('booking_id, amount_inr, status')
          .in('booking_id', bookingIds)
          .returns<Array<{ booking_id: number; amount_inr: number | null; status: string }>>();

        pendingMap = new Map(
          (collections ?? []).map((row) => [
            row.booking_id,
            {
              amountInr: Math.max(0, Number(row.amount_inr ?? 0)),
              status: row.status,
            },
          ]),
        );
      }

      let capturedByBookingId = new Map<number, number>();

      if (bookingIds.length > 0) {
        const { data: capturedRows } = await admin
          .from('payment_transactions')
          .select('booking_id, amount_inr, status')
          .in('booking_id', bookingIds)
          .eq('status', 'captured')
          .returns<Array<{ booking_id: number | null; amount_inr: number | null; status: string | null }>>();

        capturedByBookingId = (capturedRows ?? []).reduce((map, row) => {
          if (!row.booking_id) {
            return map;
          }

          const existing = map.get(row.booking_id) ?? 0;
          map.set(row.booking_id, existing + Math.max(0, Number(row.amount_inr ?? 0)));
          return map;
        }, new Map<number, number>());
      }

      const referencedProviderServiceIds = new Set<string>();
      const metadataProviderServiceIdsByBookingId = new Map<number, string[]>();

      for (const booking of bookings) {
        const providerServiceId =
          typeof booking.provider_service_id === 'string'
            ? booking.provider_service_id.trim()
            : '';

        if (providerServiceId) {
          referencedProviderServiceIds.add(providerServiceId);
        }

        for (const serviceId of extractProviderServiceIdsFromNotes(booking.provider_notes)) {
          referencedProviderServiceIds.add(serviceId);
        }

        for (const serviceId of extractProviderServiceIdsFromNotes(booking.internal_notes)) {
          referencedProviderServiceIds.add(serviceId);
        }
      }

      if (bookingIds.length > 0) {
        const { data: paymentMetadataRows, error: paymentMetadataError } = await admin
          .from('payment_transactions')
          .select('booking_id, metadata')
          .in('booking_id', bookingIds)
          .returns<Array<{ booking_id: number | null; metadata: unknown }>>();

        if (paymentMetadataError) {
          console.warn('Unable to load payment metadata for user bundled service enrichment', paymentMetadataError);
        } else {
          for (const row of paymentMetadataRows ?? []) {
            if (!row.booking_id) {
              continue;
            }

            const providerServiceIds = extractProviderServiceIdsFromPaymentMetadata(row.metadata);
            if (providerServiceIds.length === 0) {
              continue;
            }

            for (const providerServiceId of providerServiceIds) {
              referencedProviderServiceIds.add(providerServiceId);
            }

            const existing = metadataProviderServiceIdsByBookingId.get(row.booking_id) ?? [];
            if (providerServiceIds.length > existing.length) {
              metadataProviderServiceIdsByBookingId.set(row.booking_id, providerServiceIds);
            }
          }
        }
      }

      const serviceNameByProviderServiceId = new Map<string, string>();
      const serviceBasePriceByProviderServiceId = new Map<string, number>();

      if (referencedProviderServiceIds.size > 0) {
        const { data: providerServiceRows, error: providerServiceError } = await admin
          .from('provider_services')
          .select('id, service_type, base_price')
          .in('id', Array.from(referencedProviderServiceIds))
          .returns<ProviderServiceRow[]>();

        if (providerServiceError) {
          console.warn('Unable to resolve provider service names for user bundled services', providerServiceError);
        } else {
          for (const row of providerServiceRows ?? []) {
            const serviceType = row.service_type?.trim();
            if (serviceType) {
              serviceNameByProviderServiceId.set(row.id, serviceType);
            }

            const basePrice = Number(row.base_price ?? NaN);
            if (Number.isFinite(basePrice) && basePrice > 0) {
              serviceBasePriceByProviderServiceId.set(row.id, basePrice);
            }
          }
        }
      }

      const resolvePendingForBooking = (booking: {
        id: number;
        payment_mode?: string | null;
        amount?: number | null;
        final_price?: number | null;
        price_at_booking?: number | null;
      }) => {
        const totalAmount = Math.max(
          0,
          Number(booking.amount ?? booking.final_price ?? booking.price_at_booking ?? 0),
        );
        const capturedOnline = capturedByBookingId.get(booking.id) ?? 0;
        const computedPending = Math.max(0, totalAmount - capturedOnline);

        const explicitPending = pendingMap.get(booking.id);
        if (explicitPending) {
          if (explicitPending.status === 'paid') {
            return 0;
          }

          // Explicit non-paid collection rows are authoritative even when payment mode is stale.
          if (explicitPending.amountInr > 0) {
            return Math.max(0, explicitPending.amountInr);
          }

          // Some legacy rows store 0 while booking totals remain outstanding.
          // Trust computed outstanding when collection amount is missing/zero.
          return computedPending;
        }

        const paymentMode = String(booking.payment_mode ?? '').trim().toLowerCase();
        const isCashCollectionMode =
          paymentMode === 'direct_to_provider' ||
          paymentMode === 'mixed' ||
          paymentMode === 'cash';

        if (!isCashCollectionMode) {
          return 0;
        }

        return computedPending;
      };

      const enriched = bookings.map((booking) => {
        const providerId = Number((booking as { provider_id?: unknown }).provider_id ?? NaN);
        const providerName = providerNameById.get(providerId) ?? null;
        const resolvedFromNotes = resolveIncludedServicesForBooking(booking, {
          serviceNameByProviderServiceId,
          serviceBasePriceByProviderServiceId,
        });
        const providerServiceIdsFromMetadata = metadataProviderServiceIdsByBookingId.get(booking.id) ?? [];
        const resolvedFromMetadata = resolveIncludedServicesFromMetadata(
          providerServiceIdsFromMetadata,
          serviceNameByProviderServiceId,
        );
        const includedServices =
          resolvedFromMetadata.length > resolvedFromNotes.length
            ? resolvedFromMetadata
            : resolvedFromNotes;

        return {
          ...booking,
          pending_payable_inr: resolvePendingForBooking(booking),
          providers: providerName ? [{ name: providerName }] : null,
          included_services: includedServices,
        };
      });

      return NextResponse.json({ bookings: enriched });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', targetUserId)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ bookings: data ?? [] });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to load user bookings');

    logSecurityEvent('error', 'booking.failure', {
      route: 'api/user/bookings',
      actorId: user.id,
      actorRole: role,
      targetId: targetUserId,
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        responseStatus: mapped.status,
      },
    });

    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
