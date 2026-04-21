import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiRole } from '@/lib/auth/api-auth';
import {
  BOOKING_ADDON_MUTABLE_STATUSES,
  canUserMutateBookingAddons,
  getAddonAdminClient,
  getAddonEffectivePrice,
  isProviderOwnerForBooking,
  recalculateBookingAddonTotals,
} from '@/lib/addons/service';

const addAddonSchema = z.object({
  mappingId: z.string().uuid(),
  quantity: z.number().int().min(1).max(25).default(1),
  source: z.enum(['booking_flow', 'pre_service', 'in_service', 'admin_adjustment']).optional().default('booking_flow'),
  notes: z.string().trim().max(1000).optional(),
});

const updateAddonSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(25).optional(),
  status: z.enum(['selected', 'confirmed', 'fulfilled', 'cancelled', 'refunded']).optional(),
  notes: z.string().trim().max(1000).optional(),
});

async function resolveBookingAccess(
  bookingId: string,
  actorUserId: string,
  role: 'user' | 'provider' | 'admin' | 'staff',
  options?: { requireMutableStatus?: boolean },
) {
  const supabase = getAddonAdminClient();
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, user_id, provider_id, booking_status')
    .eq('id', bookingId)
    .single<{ id: string; user_id: string; provider_id: number; booking_status: string }>();

  if (error || !booking) {
    return { error: 'Booking not found', status: 404 as const, booking: null };
  }

  const requireMutableStatus = options?.requireMutableStatus ?? true;
  const mutable = BOOKING_ADDON_MUTABLE_STATUSES.has(booking.booking_status);

  if (requireMutableStatus && !mutable) {
    return { error: 'Add-ons can only be changed for pending, confirmed, or in-progress bookings.', status: 400 as const, booking: null };
  }

  const canMutateByRole = canUserMutateBookingAddons(role, booking.user_id, actorUserId);

  if (!canMutateByRole) {
    return { error: 'Forbidden', status: 403 as const, booking: null };
  }

  if (role === 'provider') {
    const providerOwnsBooking = await isProviderOwnerForBooking(supabase, actorUserId, booking.id);
    if (!providerOwnsBooking) {
      return { error: 'Forbidden', status: 403 as const, booking: null };
    }
  }

  return { error: null, status: 200 as const, booking };
}

type BookingAddonApiRow = {
  id: string;
  name_snapshot: string;
  quantity: number;
  status: string;
  total_price_inr?: number | null;
  total_price_snapshot?: number | null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const access = await resolveBookingAccess(id, auth.context.user.id, auth.context.role, { requireMutableStatus: false });

  if (access.error || !access.booking) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  try {
    const supabase = getAddonAdminClient();

    const [itemsResult, eventsResult] = await Promise.all([
      supabase
        .from('booking_addon_items')
        .select('*')
        .eq('booking_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('booking_addon_events')
        .select('*')
        .eq('booking_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (itemsResult.error || eventsResult.error) {
      const errorMessage = itemsResult.error?.message ?? eventsResult.error?.message ?? 'Failed to load booking add-ons.';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }

    const normalizedItems = ((itemsResult.data ?? []) as BookingAddonApiRow[]).map((item) => ({
      ...item,
      total_price_inr: Math.max(0, Number(item.total_price_inr ?? item.total_price_snapshot ?? 0)),
    }));

    return NextResponse.json({ success: true, data: { items: normalizedItems, events: eventsResult.data ?? [] } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const access = await resolveBookingAccess(id, auth.context.user.id, auth.context.role);

  if (access.error || !access.booking) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const parsed = addAddonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getAddonAdminClient();

    const { data: mapping, error: mappingError } = await supabase
      .from('provider_service_addon_mappings')
      .select('id, provider_service_id, addon_template_id, price_override, min_quantity, max_quantity, is_active, moderation_status, addon_templates(id, name, default_price)')
      .eq('id', parsed.data.mappingId)
      .single<{
        id: string;
        provider_service_id: string;
        addon_template_id: string;
        price_override: number | null;
        min_quantity: number;
        max_quantity: number;
        is_active: boolean;
        moderation_status: string;
        addon_templates: { id: string; name: string; default_price: number } | Array<{ id: string; name: string; default_price: number }>;
      }>();

    if (mappingError || !mapping) {
      return NextResponse.json({ success: false, error: 'Add-on mapping not found.' }, { status: 404 });
    }

    const { data: bookingService } = await supabase
      .from('bookings')
      .select('provider_service_id')
      .eq('id', id)
      .single<{ provider_service_id: string | null }>();

    if (!bookingService?.provider_service_id) {
      return NextResponse.json({ success: false, error: 'Selected add-on is not compatible with this booking service.' }, { status: 400 });
    }

    if (bookingService.provider_service_id !== mapping.provider_service_id) {
      const { data: compatibilityRows, error: compatibilityError } = await supabase
        .from('provider_services')
        .select('id, service_type')
        .in('id', [bookingService.provider_service_id, mapping.provider_service_id]);

      if (compatibilityError) {
        return NextResponse.json({ success: false, error: 'Unable to verify add-on compatibility for this booking.' }, { status: 500 });
      }

      const bookingServiceRow = (compatibilityRows ?? []).find((row) => row.id === bookingService.provider_service_id);
      const mappingServiceRow = (compatibilityRows ?? []).find((row) => row.id === mapping.provider_service_id);

      const bookingServiceType = bookingServiceRow?.service_type?.trim().toLowerCase() ?? '';
      const mappingServiceType = mappingServiceRow?.service_type?.trim().toLowerCase() ?? '';

      if (!bookingServiceType || !mappingServiceType || bookingServiceType !== mappingServiceType) {
        return NextResponse.json({ success: false, error: 'Selected add-on is not compatible with this booking service.' }, { status: 400 });
      }
    }

    if (!mapping.is_active || mapping.moderation_status !== 'approved') {
      return NextResponse.json({ success: false, error: 'Selected add-on is not active.' }, { status: 400 });
    }

    if (parsed.data.quantity < mapping.min_quantity || parsed.data.quantity > mapping.max_quantity) {
      return NextResponse.json(
        { success: false, error: `Quantity must be between ${mapping.min_quantity} and ${mapping.max_quantity}.` },
        { status: 400 },
      );
    }

    const template = Array.isArray(mapping.addon_templates) ? mapping.addon_templates[0] : mapping.addon_templates;
    const unitPrice = getAddonEffectivePrice(mapping.price_override, Number(template?.default_price ?? 0));
    const totalPrice = unitPrice * parsed.data.quantity;

    const insertPayload = {
      booking_id: id,
      addon_template_id: mapping.addon_template_id,
      provider_service_addon_mapping_id: mapping.id,
      name_snapshot: template?.name ?? 'Add-on',
      unit_price_snapshot: unitPrice,
      quantity: parsed.data.quantity,
      total_price_snapshot: totalPrice,
      status: 'selected',
      added_by_user_id: auth.context.user.id,
      added_by_role: auth.context.role,
      source: parsed.data.source,
      notes: parsed.data.notes ?? null,
    };

    const { data: item, error: itemError } = await supabase
      .from('booking_addon_items')
      .insert(insertPayload)
      .select('*')
      .single();

    if (itemError || !item) {
      return NextResponse.json({ success: false, error: itemError?.message ?? 'Failed to add booking add-on.' }, { status: 500 });
    }

    await supabase.from('booking_addon_events').insert({
      booking_addon_item_id: item.id,
      booking_id: id,
      event_type: 'added',
      actor_user_id: auth.context.user.id,
      actor_role: auth.context.role,
      previous_payload: null,
      next_payload: {
        quantity: item.quantity,
        status: item.status,
        unit_price_snapshot: item.unit_price_snapshot,
        total_price_snapshot: item.total_price_snapshot,
      },
    });

    const totals = await recalculateBookingAddonTotals(supabase, id);

    return NextResponse.json({ success: true, data: { item, totals } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['user', 'provider', 'admin', 'staff']);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const access = await resolveBookingAccess(id, auth.context.user.id, auth.context.role);

  if (access.error || !access.booking) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const parsed = updateAddonSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    if (!parsed.data.quantity && !parsed.data.status && !parsed.data.notes) {
      return NextResponse.json({ success: false, error: 'Nothing to update.' }, { status: 400 });
    }

    const supabase = getAddonAdminClient();

    const { data: currentItem, error: itemError } = await supabase
      .from('booking_addon_items')
      .select('*')
      .eq('id', parsed.data.itemId)
      .eq('booking_id', id)
      .single();

    if (itemError || !currentItem) {
      return NextResponse.json({ success: false, error: 'Booking add-on item not found.' }, { status: 404 });
    }

    const nextQuantity = parsed.data.quantity ?? currentItem.quantity;
    const payload: Record<string, unknown> = {
      quantity: nextQuantity,
      status: parsed.data.status ?? currentItem.status,
      notes: parsed.data.notes ?? currentItem.notes,
      total_price_snapshot: Number(currentItem.unit_price_snapshot ?? 0) * nextQuantity,
    };

    const { data: updatedItem, error: updateError } = await supabase
      .from('booking_addon_items')
      .update(payload)
      .eq('id', parsed.data.itemId)
      .select('*')
      .single();

    if (updateError || !updatedItem) {
      return NextResponse.json({ success: false, error: updateError?.message ?? 'Failed to update booking add-on.' }, { status: 500 });
    }

    const eventType = parsed.data.status ? 'status_updated' : parsed.data.quantity ? 'quantity_updated' : 'approved';

    await supabase.from('booking_addon_events').insert({
      booking_addon_item_id: updatedItem.id,
      booking_id: id,
      event_type: eventType,
      actor_user_id: auth.context.user.id,
      actor_role: auth.context.role,
      previous_payload: {
        quantity: currentItem.quantity,
        status: currentItem.status,
        notes: currentItem.notes,
        total_price_snapshot: currentItem.total_price_snapshot,
      },
      next_payload: {
        quantity: updatedItem.quantity,
        status: updatedItem.status,
        notes: updatedItem.notes,
        total_price_snapshot: updatedItem.total_price_snapshot,
      },
    });

    const totals = await recalculateBookingAddonTotals(supabase, id);

    return NextResponse.json({ success: true, data: { item: updatedItem, totals } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
