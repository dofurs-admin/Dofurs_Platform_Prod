'use client';

import { useEffect, useState } from 'react';
import GroomingServiceGrid from './GroomingServiceGrid';
import SubscriptionCheckoutPanel from '@/components/payments/SubscriptionCheckoutPanel';

const BOOKING_FLOW_ACTIVE_KEY = 'dofurs.booking.flow-active';
const BOOKING_FLOW_ACTIVE_EVENT = 'dofurs:booking-flow-activity';
const BOOKING_SUCCESS_FLAG_KEY = 'dofurs.booking.confirmation-active';
const BOOKING_SUCCESS_EVENT = 'dofurs:booking-confirmation-visibility';

function isFlowRailHidden() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.localStorage.getItem(BOOKING_FLOW_ACTIVE_KEY) === '1' ||
    window.localStorage.getItem(BOOKING_SUCCESS_FLAG_KEY) === '1'
  );
}

export default function BookingSupportRail() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const syncRailVisibility = () => setHidden(isFlowRailHidden());
    syncRailVisibility();

    window.addEventListener(BOOKING_FLOW_ACTIVE_EVENT, syncRailVisibility);
    window.addEventListener(BOOKING_SUCCESS_EVENT, syncRailVisibility);
    window.addEventListener('storage', syncRailVisibility);

    return () => {
      window.removeEventListener(BOOKING_FLOW_ACTIVE_EVENT, syncRailVisibility);
      window.removeEventListener(BOOKING_SUCCESS_EVENT, syncRailVisibility);
      window.removeEventListener('storage', syncRailVisibility);
    };
  }, []);

  if (hidden) {
    return (
      <div className="mt-6 rounded-2xl border border-[#edd8c5] bg-[#fff7ef] px-4 py-3 text-sm text-[#855332]">
        Focus mode enabled while your booking is in progress.
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      <GroomingServiceGrid />
      <SubscriptionCheckoutPanel />
    </div>
  );
}
