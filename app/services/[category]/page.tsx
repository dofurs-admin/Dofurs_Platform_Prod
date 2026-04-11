import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';
import ServiceBrowseClient from '@/components/services/ServiceBrowseClient';
import type { BrowseProvider } from '@/components/services/ServiceBrowseClient';

// Slug → service_type mapping (matches provider_services.service_type values)
const CATEGORY_MAP: Record<string, { serviceType: string; label: string }> = {
  grooming: { serviceType: 'grooming', label: 'Pet Grooming' },
  'vet-visits': { serviceType: 'vet_consultation', label: 'Vet Visits' },
  vet: { serviceType: 'vet_consultation', label: 'Vet Visits' },
  'pet-sitting': { serviceType: 'pet_sitting', label: 'Pet Sitting' },
  training: { serviceType: 'training', label: 'Pet Training' },
  teleconsult: { serviceType: 'vet_consultation', label: 'Vet Teleconsult' },
};

type PageProps = {
  params: Promise<{ category: string }>;
};

export async function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((category) => ({ category }));
}

export default async function ServiceCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const mapping = CATEGORY_MAP[category];

  if (!mapping) {
    notFound();
  }

  const supabase = getSupabaseAdminClient();

  // Today's day of week (0=Sunday…6=Saturday)
  const todayDow = new Date().getDay();

  // Fetch providers that offer this service type + their availability for today
  const [providerServicesResult, availabilityResult] = await Promise.all([
    supabase
      .from('provider_services')
      .select(`
        provider_id,
        service_type,
        service_mode,
        base_price,
        is_active,
        service_pincodes,
        providers!inner (
          id,
          name,
          provider_type,
          profile_photo_url,
          average_rating,
          total_bookings,
          admin_approval_status,
          account_status
        )
      `)
      .eq('service_type', mapping.serviceType)
      .eq('is_active', true)
      .limit(60),
    supabase
      .from('provider_availability')
      .select('provider_id, is_available, slot_count')
      .eq('day_of_week', todayDow)
      .eq('is_available', true),
  ]);

  // Build set of provider IDs that have availability today
  const availableTodayIds = new Set(
    (availabilityResult.data ?? []).map((row) => row.provider_id),
  );

  const providers: BrowseProvider[] = (providerServicesResult.data ?? [])
    .filter((row) => {
      const p = row.providers as { admin_approval_status?: string; account_status?: string } | null;
      return p?.admin_approval_status === 'approved' && p?.account_status === 'active';
    })
    .map((row) => {
      const p = row.providers as unknown as {
        id: number;
        name: string;
        provider_type: string | null;
        profile_photo_url: string | null;
        average_rating: number | null;
        total_bookings: number | null;
        admin_approval_status: string;
        account_status: string;
      };
      const availableToday = availableTodayIds.has(p.id);
      return {
        id: p.id,
        name: p.name,
        provider_type: p.provider_type,
        profile_photo_url: p.profile_photo_url,
        average_rating: p.average_rating,
        total_bookings: p.total_bookings,
        base_price: row.base_price,
        service_mode: row.service_mode,
        is_verified: p.admin_approval_status === 'approved',
        service_type: row.service_type,
        // availableSlotCount: null means unknown, 0 = unavailable, >0 = has slots
        availableSlotCount: availableToday ? 1 : 0,
        service_pincodes: (row.service_pincodes as string[] | null) ?? null,
      };
    });

  return (
    <>
      <Navbar />
      <main className="dofurs-mobile-main min-h-screen bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_40%,#fffcf9_100%)] pt-20">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <Suspense
            fallback={
              <div className="rounded-2xl border border-[#e7c4a7] bg-white p-6 text-sm text-neutral-600 shadow-sm">
                Loading providers...
              </div>
            }
          >
            <ServiceBrowseClient
              providers={providers}
              category={category}
              categoryLabel={mapping.label}
            />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
