'use client';

import { useRef, useEffect, useCallback } from 'react';

export default function AutoScrollRail({
  children,
  className,
  intervalMs = 4000,
}: {
  children: React.ReactNode;
  className?: string;
  intervalMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const indexRef = useRef(0);

  const scrollNext = useCallback(() => {
    const el = ref.current;
    if (!el || pausedRef.current) return;

    const cards = Array.from(el.children) as HTMLElement[];
    if (cards.length <= 1) return;

    indexRef.current = (indexRef.current + 1) % cards.length;
    const target = cards[indexRef.current];
    el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Only auto-scroll on mobile (when overflow is active)
    const mql = window.matchMedia('(min-width: 1024px)');
    if (mql.matches) return;

    const id = setInterval(scrollNext, intervalMs);

    const pause = () => { pausedRef.current = true; };
    const resume = () => {
      pausedRef.current = false;
      // Sync index with current scroll position on resume
      const cards = Array.from(el.children) as HTMLElement[];
      const scrollLeft = el.scrollLeft;
      let closest = 0;
      let minDist = Infinity;
      cards.forEach((card, i) => {
        const dist = Math.abs(card.offsetLeft - scrollLeft);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      indexRef.current = closest;
    };

    el.addEventListener('pointerdown', pause);
    el.addEventListener('pointerup', resume);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', resume);

    return () => {
      clearInterval(id);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('pointerup', resume);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend', resume);
    };
  }, [intervalMs, scrollNext]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
