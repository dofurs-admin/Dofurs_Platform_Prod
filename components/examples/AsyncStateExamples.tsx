/**
 * EXAMPLE: Using Async State Hooks
 * 
 * This file demonstrates how to properly use useAsyncState and useAsyncData hooks
 * with the AsyncState component for standardized async state management.
 * 
 * Copy these patterns to your components!
 */

'use client';

import { useEffect } from 'react';
import { useAsyncState, useAsyncData } from '@/lib/hooks';
import AsyncState from '@/components/ui/AsyncState';

/**
 * Example 1: Simple list with automatic data fetching
 * Best for: Simple fetch operations with no mutations
 */
export function SimpleListExample() {
  type Pet = { id: number; name: string };

  const { isLoading, isError, errorMessage, data, isEmpty } = useAsyncData<Pet[]>(
    async () => {
      const res = await fetch('/api/user/pets');
      if (!res.ok) throw new Error('Failed to load pets');
      return res.json();
    },
    [] // Dependencies: re-fetch when changed
  );

  return (
    <div className="space-y-4">
      <h2>My Pets</h2>
      <AsyncState
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        isEmpty={isEmpty}
        loadingLines={4}
      >
        <ul className="space-y-2">
          {data?.map((pet) => (
            <li key={pet.id} className="p-2 border rounded">
              {pet.name}
            </li>
          ))}
        </ul>
      </AsyncState>
    </div>
  );
}

/**
 * Example 2: Component with manual async operations
 * Best for: Multiple operations, mutations, or complex loading states
 */
export function ManualAsyncExample() {
  type Profile = { name: string; email: string };

  const {
    isLoading,
    isError,
    errorMessage,
    data: profile,
    isEmpty,
    setLoading,
    setError,
    setData,
  } = useAsyncState<Profile>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) throw new Error('Failed to load profile');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [setLoading, setError, setData]);

  async function updateProfile(name: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2>My Profile</h2>
      <AsyncState
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        isEmpty={isEmpty}
      >
        {profile && (
          <div className="space-y-3">
            <p>Name: {profile.name}</p>
            <p>Email: {profile.email}</p>
            <button
              onClick={() => updateProfile(`Updated ${Date.now()}`)}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Update Name
            </button>
          </div>
        )}
      </AsyncState>
    </div>
  );
}

/**
 * Example 3: Multiple independent async states
 * Best for: Dashboards with multiple data sources
 */
export function MultipleStateExample() {
  type Booking = { id: number; status: string };
  type Pet = { id: number; name: string };

  const bookingsState = useAsyncData<Booking[]>(
    async () => {
      const res = await fetch('/api/bookings');
      if (!res.ok) throw new Error('Failed to load bookings');
      return res.json();
    },
    []
  );

  const petsState = useAsyncData<Pet[]>(
    async () => {
      const res = await fetch('/api/pets');
      if (!res.ok) throw new Error('Failed to load pets');
      return res.json();
    },
    []
  );

  const isLoading = bookingsState.isLoading || petsState.isLoading;
  const hasErrors = bookingsState.isError || petsState.isError;

  return (
    <div className="space-y-6">
      <div>
        <h3>Loading Status: {isLoading ? 'Loading...' : 'Ready'}</h3>
        {hasErrors && <p className="text-red-500">Some data failed to load</p>}
      </div>

      <section>
        <h2>Bookings</h2>
        <AsyncState {...bookingsState} loadingLines={3}>
          <div className="space-y-2">
            {bookingsState.data?.map((booking) => (
              <div key={booking.id} className="p-2 border rounded">
                Booking {booking.id}: {booking.status}
              </div>
            ))}
          </div>
        </AsyncState>
      </section>

      <section>
        <h2>Pets</h2>
        <AsyncState {...petsState} loadingLines={3}>
          <div className="space-y-2">
            {petsState.data?.map((pet) => (
              <div key={pet.id} className="p-2 border rounded">
                {pet.name}
              </div>
            ))}
          </div>
        </AsyncState>
      </section>
    </div>
  );
}

/**
 * Example 4: With dependency-based re-fetching
 * Best for: Detail views that depend on params or state
 */
export function DependentFetchExample({ bookingId }: { bookingId: number }) {
  type BookingDetail = { id: number; status: string; notes: string };

  const { isLoading, isError, errorMessage, data } = useAsyncData<BookingDetail>(
    async () => {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) throw new Error('Failed to load booking');
      return res.json();
    },
    [bookingId] // Re-fetch when bookingId changes!
  );

  return (
    <AsyncState
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      isEmpty={!data}
    >
      {data && (
        <div className="p-4 border rounded">
          <h3>Booking #{data.id}</h3>
          <p>Status: {data.status}</p>
          <p>Notes: {data.notes}</p>
        </div>
      )}
    </AsyncState>
  );
}

/**
 * Key Takeaways:
 * 
 * 1. Use useAsyncData for simple fetch → state flow
 * 2. Use useAsyncState when you need mutation methods
 * 3. Always wrap rendering in AsyncState component
 * 4. Provide proper error messages for user feedback
 * 5. Handle all 4 states: loading, error, empty, success
 * 6. Include dependencies array for re-fetching
 * 7. Clean up with return function in effects
 */
