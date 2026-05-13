export type AddonModerationStatus = 'draft' | 'pending_review' | 'approved' | 'paused' | 'retired';

export type AddonActorRole = 'admin' | 'staff' | 'provider' | 'user' | 'system';

export type BookingAddonStatus = 'selected' | 'confirmed' | 'fulfilled' | 'cancelled' | 'refunded';

export interface AddonTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  default_duration_minutes: number | null;
  default_price: number;
  is_active: boolean;
  moderation_status: AddonModerationStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderServiceAddonMapping {
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
  moderation_status: AddonModerationStatus;
  source_role: AddonActorRole;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingAddonItem {
  id: string;
  booking_id: string;
  addon_template_id: string | null;
  provider_service_addon_mapping_id: string | null;
  name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  total_price_snapshot: number;
  status: BookingAddonStatus;
  added_by_user_id: string | null;
  added_by_role: AddonActorRole;
  source: 'booking_flow' | 'pre_service' | 'in_service' | 'admin_adjustment';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingAddonEvent {
  id: string;
  booking_addon_item_id: string;
  booking_id: string;
  event_type: 'added' | 'quantity_updated' | 'status_updated' | 'removed' | 'refunded' | 'approved' | 'rejected';
  actor_user_id: string | null;
  actor_role: AddonActorRole;
  previous_payload: Record<string, unknown> | null;
  next_payload: Record<string, unknown> | null;
  created_at: string;
}
