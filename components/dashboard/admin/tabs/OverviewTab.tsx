'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminOverviewView from '@/components/dashboard/admin/views/AdminOverviewView';
import { useAdminBookingRealtime, useAdminProviderApprovalRealtime } from '@/lib/hooks/useRealtime';
import type { AdminDashboardBusinessStats } from '@/lib/admin/dashboard-stats';

type OverviewTabProps = {
  initialBusinessStats: AdminDashboardBusinessStats;
};

export default function OverviewTab({
  initialBusinessStats,
}: OverviewTabProps) {
  const router = useRouter();
  const [businessStats, setBusinessStats] = useState(initialBusinessStats);

  const refreshBusinessStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/dashboard-stats', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { businessStats?: AdminDashboardBusinessStats; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to refresh admin dashboard statistics.');
      }

      if (payload.businessStats) {
        setBusinessStats(payload.businessStats);
      }
    } catch (error) {
      console.error('Failed to refresh admin dashboard statistics:', error);
    }
  }, []);

  useEffect(() => {
    setBusinessStats(initialBusinessStats);
  }, [initialBusinessStats]);

  useEffect(() => {
    void refreshBusinessStats();
  }, [refreshBusinessStats]);

  useAdminBookingRealtime(refreshBusinessStats);
  useAdminProviderApprovalRealtime(refreshBusinessStats);

  function handleNavigate(view: 'payments' | 'subscriptions' | 'billing') {
    router.push(`/dashboard/admin/${view}`);
  }

  return (
    <AdminOverviewView
      bookingCount={businessStats.bookingCount}
      bookingServiceUnitCount={businessStats.bookingServiceUnitCount}
      bookingRiskSummary={businessStats.bookingRiskSummary}
      providerCount={businessStats.providerCount}
      serviceCount={businessStats.serviceCount}
      customerCount={businessStats.customerCount}
      activeDiscountCount={businessStats.activeDiscountCount}
      onNavigate={handleNavigate}
    />
  );
}
