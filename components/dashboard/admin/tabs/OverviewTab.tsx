'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminOverviewView from '@/components/dashboard/admin/views/AdminOverviewView';
import type { Service } from '@/lib/service-catalog/types';
import type { PlatformDiscountAnalyticsSummary } from '@/lib/provider-management/types';

type AdminBooking = {
  id: number;
  user_id?: string;
  booking_status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  customer_email?: string | null;
  customer_phone?: string | null;
};

type OverviewTabProps = {
  initialBookings: AdminBooking[];
  providerCount: number;
  initialCatalogServices: Service[];
  initialServiceCategories: { id: string; name: string }[];
  initialDiscountAnalytics: PlatformDiscountAnalyticsSummary;
};

export default function OverviewTab({
  initialBookings,
  providerCount,
  initialCatalogServices,
  initialDiscountAnalytics,
}: OverviewTabProps) {
  const router = useRouter();

  const bookingRiskSummary = useMemo(() => {
    return {
      inProgress: initialBookings.filter((b) => {
        const status = b.booking_status ?? b.status;
        return status === 'pending' || status === 'confirmed';
      }).length,
      completed: initialBookings.filter((b) => (b.booking_status ?? b.status) === 'completed').length,
      pending: initialBookings.filter((b) => (b.booking_status ?? b.status) === 'pending').length,
      noShow: initialBookings.filter((b) => (b.booking_status ?? b.status) === 'no_show').length,
      cancelled: initialBookings.filter((b) => (b.booking_status ?? b.status) === 'cancelled').length,
    };
  }, [initialBookings]);

  const totalCustomers = useMemo(() => {
    const keys = new Set<string>();
    for (const booking of initialBookings) {
      const key = booking.user_id ?? booking.customer_email ?? booking.customer_phone;
      if (key) keys.add(key.toLowerCase());
    }
    return keys.size;
  }, [initialBookings]);

  function handleNavigate(view: 'payments' | 'subscriptions' | 'billing') {
    router.push(`/dashboard/admin/${view}`);
  }

  return (
    <AdminOverviewView
      bookingCount={initialBookings.length}
      bookingRiskSummary={bookingRiskSummary}
      providerCount={providerCount}
      serviceCount={initialCatalogServices.length}
      customerCount={totalCustomers}
      activeDiscountCount={initialDiscountAnalytics.total_active_discounts}
      onNavigate={handleNavigate}
    />
  );
}
