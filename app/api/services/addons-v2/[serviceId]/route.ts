import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { isRateLimited } from '@/lib/api/rate-limit';
import { toFriendlyApiError } from '@/lib/api/errors';

const paramsSchema = z.object({
  serviceId: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> },
) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = isRateLimited(`svc-addons-v2:${clientIp}`, { windowMs: 60_000, maxRequests: 60 });

  if (rate.limited) {
    return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const { serviceId } = await context.params;
    const parsed = paramsSchema.safeParse({ serviceId });

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request parameters', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    const { data: selectedService, error: selectedServiceError } = await supabase
      .from('provider_services')
      .select('id, service_type')
      .eq('id', parsed.data.serviceId)
      .maybeSingle<{ id: string; service_type: string | null }>();

    if (selectedServiceError) {
      const mapped = toFriendlyApiError(selectedServiceError, 'Failed to resolve selected service');
      return NextResponse.json({ success: false, error: mapped.message }, { status: mapped.status });
    }

    if (!selectedService) {
      return NextResponse.json({ success: false, error: 'Service not found.' }, { status: 404 });
    }

    const { data: directMappings, error: directMappingsError } = await supabase
      .from('provider_service_addon_mappings')
      .select(
        'id, provider_service_id, addon_template_id, price_override, min_quantity, max_quantity, default_quantity, is_required, is_active, display_order, moderation_status, addon_templates(id, name, description, icon_url, default_duration_minutes, default_price, is_active, moderation_status)',
      )
      .eq('provider_service_id', parsed.data.serviceId)
      .eq('is_active', true)
      .eq('moderation_status', 'approved')
      .order('display_order', { ascending: true });

    if (directMappingsError) {
      const mapped = toFriendlyApiError(directMappingsError, 'Failed to load add-on mappings');
      return NextResponse.json({ success: false, error: mapped.message }, { status: mapped.status });
    }

    const mapRows = (
      data: Array<{
        id: string;
        provider_service_id: string;
        addon_template_id: string;
        price_override: number | null;
        min_quantity: number;
        max_quantity: number;
        default_quantity: number;
        is_required: boolean;
        is_active: boolean;
        display_order: number;
        moderation_status: string;
        addon_templates:
          | {
              id: string;
              name: string;
              description: string | null;
              icon_url: string | null;
              default_duration_minutes: number | null;
              default_price: number | null;
              is_active: boolean;
              moderation_status: string;
            }
          | Array<{
              id: string;
              name: string;
              description: string | null;
              icon_url: string | null;
              default_duration_minutes: number | null;
              default_price: number | null;
              is_active: boolean;
              moderation_status: string;
            }>;
      }>,
    ) =>
      (data ?? [])
      .filter((row) => {
        const template = Array.isArray(row.addon_templates) ? row.addon_templates[0] : row.addon_templates;
        return Boolean(template?.is_active) && template?.moderation_status === 'approved';
      })
      .map((row) => {
      const template = Array.isArray(row.addon_templates) ? row.addon_templates[0] : row.addon_templates;
      const price = Number(row.price_override ?? template?.default_price ?? 0);

      return {
        id: row.id,
        mappingId: row.id,
        serviceId: row.provider_service_id,
        addonTemplateId: row.addon_template_id,
        name: template?.name ?? 'Add-on',
        description: template?.description ?? null,
        iconUrl: template?.icon_url ?? null,
        durationMinutes: template?.default_duration_minutes ?? null,
        price,
        minQuantity: row.min_quantity,
        maxQuantity: row.max_quantity,
        defaultQuantity: row.default_quantity,
        isRequired: row.is_required,
      };
    });

    const directRows = mapRows(directMappings ?? []);
    if (directRows.length > 0) {
      return NextResponse.json(
        { success: true, data: directRows },
        { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' } },
      );
    }

    const normalizedServiceType = (selectedService.service_type ?? '').trim();

    if (!normalizedServiceType) {
      return NextResponse.json(
        { success: true, data: [] },
        { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' } },
      );
    }

    const { data: catalogServices, error: catalogServicesError } = await supabase
      .from('provider_services')
      .select('id')
      .is('provider_id', null)
      .eq('is_active', true)
      .eq('service_type', normalizedServiceType);

    if (catalogServicesError) {
      const mapped = toFriendlyApiError(catalogServicesError, 'Failed to resolve catalog services');
      return NextResponse.json({ success: false, error: mapped.message }, { status: mapped.status });
    }

    const catalogServiceIds = Array.from(new Set((catalogServices ?? []).map((row) => row.id)));

    if (catalogServiceIds.length === 0) {
      return NextResponse.json(
        { success: true, data: [] },
        { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' } },
      );
    }

    const { data: catalogMappings, error: catalogMappingsError } = await supabase
      .from('provider_service_addon_mappings')
      .select(
        'id, provider_service_id, addon_template_id, price_override, min_quantity, max_quantity, default_quantity, is_required, is_active, display_order, moderation_status, addon_templates(id, name, description, icon_url, default_duration_minutes, default_price, is_active, moderation_status)',
      )
      .in('provider_service_id', catalogServiceIds)
      .eq('is_active', true)
      .eq('moderation_status', 'approved')
      .order('display_order', { ascending: true });

    if (catalogMappingsError) {
      const mapped = toFriendlyApiError(catalogMappingsError, 'Failed to load fallback add-on mappings');
      return NextResponse.json({ success: false, error: mapped.message }, { status: mapped.status });
    }

    const fallbackRows = mapRows(catalogMappings ?? []);

    const dedupedFallbackRows = Array.from(
      fallbackRows.reduce((map, row) => {
        const key = row.addonTemplateId;
        if (!map.has(key)) {
          map.set(key, row);
        }
        return map;
      }, new Map<string, (typeof fallbackRows)[number]>()),
    ).map(([, row]) => row);

    return NextResponse.json(
      { success: true, data: dedupedFallbackRows },
      { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' } },
    );
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load add-on mappings');
    return NextResponse.json({ success: false, error: mapped.message }, { status: mapped.status });
  }
}
