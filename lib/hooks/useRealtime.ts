/**
 * Realtime Hooks for Supabase Subscriptions
 * 
 * Custom hooks for managing realtime database subscriptions with automatic cleanup.
 * Provides optimistic UI updates and real-time synchronization for:
 * - Booking status changes
 * - Provider approvals
 * - Slot availability updates
 */

import { useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

type RealtimePayload = {
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

/**
 * Subscribe to booking changes for a specific user
 * Updates bookings in real-time when status changes, new bookings arrive, etc.
 */
export function useBookingRealtime(userId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`bookings:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onUpdate();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, onUpdate]);
}

/**
 * Subscribe to booking changes for a specific provider
 * Updates provider's bookings when customers book/cancel/update
 */
export function useProviderBookingRealtime(providerId: number | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!providerId) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`bookings:provider:${providerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${providerId}`,
        },
        () => {
          onUpdate();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [providerId, onUpdate]);
}

/**
 * Subscribe to all booking changes (admin view)
 * Updates admin dashboard when any booking changes
 */
export function useAdminBookingRealtime(onUpdate: () => void) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel('bookings:admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          onUpdate();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}

/**
 * Subscribe to provider approval status changes
 * Updates when admin approves/rejects provider applications
 */
export function useProviderApprovalRealtime(providerId: number | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!providerId) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`providers:approval:${providerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'providers',
          filter: `id=eq.${providerId}`,
        },
        (payload: RealtimePayload) => {
          if (payload.new && 'admin_approval_status' in payload.new) {
            onUpdate();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [providerId, onUpdate]);
}

/**
 * Subscribe to all provider approval changes (admin view)
 * Updates admin dashboard when any provider approval status changes
 */
export function useAdminProviderApprovalRealtime(onUpdate: () => void) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel('providers:admin:approvals')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'providers',
        },
        (payload: RealtimePayload) => {
          if (payload.new && ('admin_approval_status' in payload.new || 'account_status' in payload.new)) {
            onUpdate();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}

/**
 * Subscribe to slot availability changes for a specific provider and date
 * Updates when bookings are made/cancelled or availability changes
 */
export function useSlotRealtime(
  providerId: number | undefined,
  bookingDate: string | undefined,
  onUpdate: () => void,
) {
  useEffect(() => {
    if (!providerId || !bookingDate) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`slots:provider:${providerId}:${bookingDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${providerId}`,
        },
        (payload: RealtimePayload) => {
          // Filter for bookings on the specific date
          const newBookingDate = payload.new && 'booking_date' in payload.new ? payload.new.booking_date : null;
          const oldBookingDate = payload.old && 'booking_date' in payload.old ? payload.old.booking_date : null;
          
          if (newBookingDate === bookingDate || oldBookingDate === bookingDate) {
            onUpdate();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_availability',
          filter: `provider_id=eq.${providerId}`,
        },
        () => {
          onUpdate();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_blocked_dates',
          filter: `provider_id=eq.${providerId}`,
        },
        (payload: RealtimePayload) => {
          // Filter for blocked dates matching the booking date
          const blockedDate = payload.new && 'blocked_date' in payload.new ? payload.new.blocked_date : null;
          
          if (blockedDate === bookingDate) {
            onUpdate();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [providerId, bookingDate, onUpdate]);
}

/**
 * Generic realtime subscription hook for custom use cases
 * Provides a flexible way to subscribe to any table changes
 */
export function useRealtimeSubscription(
  channelName: string,
  table: string,
  filter: string | undefined,
  onUpdate: (payload: unknown) => void,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*',
) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    
    let channel = supabase.channel(channelName);
    
    const config: {
      event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
      schema: 'public';
      table: string;
      filter?: string;
    } = {
      event,
      schema: 'public',
      table,
    };
    
    if (filter) {
      config.filter = filter;
    }
    
    channel = channel.on('postgres_changes', config, onUpdate);
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, table, filter, event, onUpdate]);
}

/**
 * Optimistic update helper
 * Performs an optimistic UI update, then reverts on API failure
 */
export function useOptimisticUpdate<T>(
  data: T[],
  setData: (data: T[]) => void,
) {
  const performUpdate = useCallback(
    async (
      optimisticUpdate: (data: T[]) => T[],
      apiCall: () => Promise<void>,
      onSuccess?: () => void,
      onError?: (error: Error) => void,
    ) => {
      // Store original data for rollback
      const originalData = [...data];
      
      // Apply optimistic update immediately
      setData(optimisticUpdate(data));
      
      try {
        // Perform API call
        await apiCall();
        
        // Success callback
        onSuccess?.();
      } catch (error) {
        // Rollback on error
        setData(originalData);
        
        // Error callback
        onError?.(error instanceof Error ? error : new Error('Update failed'));
      }
    },
    [data, setData],
  );

  return { performUpdate };
}
