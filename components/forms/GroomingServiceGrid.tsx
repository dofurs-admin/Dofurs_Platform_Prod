'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GroomingServiceCard, { type GroomingService } from './GroomingServiceCard';

const BOOKING_SUCCESS_FLAG_KEY = 'dofurs.booking.confirmation-active';
const BOOKING_SUCCESS_EVENT = 'dofurs:booking-confirmation-visibility';

const GROOMING_SERVICES: GroomingService[] = [
  {
    title: 'Doorstep Pet Grooming',
    price: 'Starts from 899',
    features: [
      'Nail Trimming',
      'Paw Hair Trimming',
      'Knot Removal & De-shedding',
      'Eye & Ear Cleaning',
    ],
    badge: 'Popular',
    badgeVariant: 'popular',
  },
  {
    title: 'Summer Bonanza',
    price: 1199,
    features: [
      'Bathing, Drying & Conditioning',
      'Shampoo & Conditioner',
      'Brushing & De-shedding',
      'De-matting',
      'Nail Clipping & Paw Cleaning',
    ],
    badge: 'Great Deal',
    badgeVariant: 'deal',
  },
  {
    title: 'Essential Grooming',
    price: 1799,
    features: [
      'Bathing, Drying & Conditioning',
      'Nail Clipping',
      'Paw Hair Cleaning',
      'Sanitary Cleaning',
      'Brushing & De-shedding',
      'De-matting',
      'Paw Massage',
      'Eye Cleaning',
      'Standard Haircut',
    ],
    badge: 'Best Value',
    badgeVariant: 'best-value',
    highlighted: true,
  },
  {
    title: 'Complete Care',
    price: 2299,
    features: [
      'Bathing, Drying & Conditioning',
      'Nail Clipping & Grinding',
      'Paw Care & Massage',
      'Sanitary Cleaning',
      'Brushing & De-shedding',
      'De-matting',
      'Custom Haircut',
      'Face Styling',
      'Eye, Ear & Nose Cleaning',
    ],
    badge: 'Premium',
    badgeVariant: 'premium',
  },
  {
    title: 'Pet Birthday Package',
    price: 1999,
    features: ['Custom Party Setup', 'Treats & Decorations', 'Photoshoots'],
    badge: 'Special',
    badgeVariant: 'special',
  },
  {
    title: 'Pet Boarding',
    price: 999,
    features: ['Safe Stay', 'Comfortable Environment', 'Stress-Free Care'],
    badge: 'COMMING SOON',
    badgeVariant: 'coming-soon',
  },
];

export default function GroomingServiceGrid() {
  const [isHiddenForConfirmation, setIsHiddenForConfirmation] = useState(false);

  useEffect(() => {
    const syncVisibility = () => {
      if (typeof window === 'undefined') {
        return;
      }

      setIsHiddenForConfirmation(window.localStorage.getItem(BOOKING_SUCCESS_FLAG_KEY) === '1');
    };

    syncVisibility();
    window.addEventListener(BOOKING_SUCCESS_EVENT, syncVisibility as EventListener);
    window.addEventListener('storage', syncVisibility);

    return () => {
      window.removeEventListener(BOOKING_SUCCESS_EVENT, syncVisibility as EventListener);
      window.removeEventListener('storage', syncVisibility);
    };
  }, []);

  function handleBookNow(title: string) {
    // Write the selected service title to localStorage so the booking flow auto-selects it
    try {
      window.localStorage.setItem('dofurs.booking.selectedServiceType', title);
      window.dispatchEvent(new Event('dofurs:service-type-selected'));
    } catch {
      // Ignore storage errors
    }
    const anchor = document.getElementById('start-your-booking');
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (isHiddenForConfirmation) {
    return null;
  }

  return (
    <section className="pb-3 pt-5 md:pb-4 md:pt-7">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mb-5 text-center"
      >
        <p className="mx-auto text-xs font-semibold uppercase tracking-[0.14em] text-[#9a6a44]">
          Premium Pet Care
        </p>
        <h2 className="mt-1.5 text-xl font-semibold text-neutral-950 md:text-2xl">
          Choose Your Package
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-[#6e4d35] md:text-sm">
          Professionally curated for your pet&apos;s well-being. All services available at your
          doorstep across Bangalore.
        </p>
      </motion.div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {GROOMING_SERVICES.map((service, index) => (
          <GroomingServiceCard
            key={service.title}
            service={service}
            index={index}
            onBookNow={handleBookNow}
          />
        ))}
      </div>

      {/* Scroll cue */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="mt-5 text-center text-xs text-[#a07c5c]"
      >
        Click &ldquo;Book Now&rdquo; on any package to begin — availability confirmed in real time.
      </motion.p>
    </section>
  );
}
