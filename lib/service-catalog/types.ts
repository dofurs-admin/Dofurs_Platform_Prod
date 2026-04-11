/**
 * Service Catalog System Types
 * Defines all TypeScript interfaces for the service management system including
 * categories, services, add-ons, and media.
 */

// ============================================================================
// SERVICE CATEGORIES
// ============================================================================

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
  banner_image_url?: string | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceCategoryInput = Pick<
  ServiceCategory,
  | "name"
  | "slug"
  | "description"
  | "icon_url"
  | "banner_image_url"
  | "display_order"
  | "is_featured"
  | "is_active"
>;

// ============================================================================
// SERVICES (PROVIDER_SERVICES EXTENDED)
// ============================================================================

export type ServiceMode = "home_visit" | "clinic_visit" | "teleconsult";

export interface Service {
  id: string;
  provider_id?: string | bigint | null;
  category_id?: string | null;
  service_type: string;
  slug?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  service_mode: ServiceMode;
  icon_url?: string | null;
  banner_image_url?: string | null;
  base_price: number;
  surge_price?: number | null;
  commission_percentage?: number | null;
  service_duration_minutes?: number | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  requires_pet_details: boolean;
  requires_location: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceInput = Omit<Service, "id" | "created_at" | "updated_at">;

export type ServiceUpdate = Partial<ServiceInput>;

// ============================================================================
// SERVICE ADD-ONS
// ============================================================================

export interface ServiceAddon {
  id: string;
  provider_service_id: string;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes?: number | null;
  icon_url?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceAddonInput = Omit<
  ServiceAddon,
  "id" | "created_at" | "updated_at"
>;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// ADMIN DASHBOARD CONTEXTS
// ============================================================================

/**
 * Admin service management context
 * Provides data for admin dashboard service/category/addon management
 */
export interface AdminServiceContext {
  categories: ServiceCategory[];
  services: Service[];
  selectedCategory?: ServiceCategory | null;
  selectedService?: Service | null;
}

/**
 * Service moderation queue for admin operations
 */
export interface ServiceModerationItem {
  id: string;
  type: "service" | "category" | "addon";
  status: "pending_approval" | "approved" | "rejected";
  created_at: string;
  submitted_by: string;
  data: ServiceCategory | Service | ServiceAddon;
}
