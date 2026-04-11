/**
 * Service Catalog Utilities
 * Core business logic for service catalog operations including pricing,
 * service catalog fetching, and booking calculations.
 */

import { createClient } from "@supabase/supabase-js";
import type {
  Service,
  ServiceAddon,
} from "./types";
import {
  calculateBookingPrice as calculateBookingPriceFromEngine,
  type BookingPriceParameters,
} from "./engines/pricing-engine";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// SERVICE CATALOG FETCHING
// ============================================================================

/**
 * Get all active categories
 */
export async function getActiveCategories() {
  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Get services by category and provider
 */
export async function getServicesByCategory(
  categoryId: string,
  providerId: string | bigint
) {
  const { data, error } = await supabase
    .from("provider_services")
    .select("*")
    .eq("category_id", categoryId)
    .eq("provider_id", providerId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data as Service[];
}

/**
 * Get service add-ons for a service
 */
export async function getServiceAddOns(serviceId: string) {
  const { data, error } = await supabase
    .from("service_addons")
    .select("*")
    .eq("provider_service_id", serviceId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data as ServiceAddon[];
}

// ============================================================================
// BOOKING PRICE CALCULATION
// ============================================================================

export type { BookingPriceParameters };

export async function calculateBookingPrice(params: BookingPriceParameters) {
  return calculateBookingPriceFromEngine(params);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate service exists and is active
 */
export async function validateService(serviceId: string, providerId: string | bigint) {
  const { data, error } = await supabase
    .from("provider_services")
    .select("id, is_active")
    .eq("id", serviceId)
    .eq("provider_id", providerId)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Service not found");
  if (!data.is_active) throw new Error("Service is not active");

  return true;
}

