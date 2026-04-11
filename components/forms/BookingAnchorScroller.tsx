'use client';

import { useEffect } from 'react';

const HEADER_OFFSET_PX = 96;

function scrollToBookingAnchor() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.hash !== '#start-your-booking') {
    return;
  }

  const target = document.getElementById('start-your-booking');
  if (!target) {
    return;
  }

  const targetTop = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX;
  window.scrollTo({
    top: Math.max(targetTop, 0),
    behavior: 'auto',
  });
}

export default function BookingAnchorScroller() {
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      scrollToBookingAnchor();
      window.setTimeout(scrollToBookingAnchor, 120);
    });

    const handleHashChange = () => {
      scrollToBookingAnchor();
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return null;
}
