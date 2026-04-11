'use client';

import { useEffect, useMemo, useState } from 'react';

function toRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function shouldTrackRequest(input: RequestInfo | URL): boolean {
  try {
    const rawUrl = toRequestUrl(input);
    const url = new URL(rawUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export default function GlobalNetworkCursorLoader() {
  const [pendingRequests, setPendingRequests] = useState(0);
  const [isFinePointer, setIsFinePointer] = useState(false);
  const [cursorX, setCursorX] = useState(24);
  const [cursorY, setCursorY] = useState(24);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(pointer: fine)');
    const updatePointerCapability = () => setIsFinePointer(media.matches);

    updatePointerCapability();
    media.addEventListener('change', updatePointerCapability);

    return () => media.removeEventListener('change', updatePointerCapability);
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setCursorX(event.clientX);
      setCursorY(event.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const shouldTrack = shouldTrackRequest(args[0]);

      if (shouldTrack) {
        setPendingRequests((current) => current + 1);
      }

      try {
        return await originalFetch(...args);
      } finally {
        if (shouldTrack) {
          setPendingRequests((current) => Math.max(0, current - 1));
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (pendingRequests <= 0) {
      setIsVisible(false);
      return;
    }

    const showTimer = window.setTimeout(() => setIsVisible(true), 120);
    return () => window.clearTimeout(showTimer);
  }, [pendingRequests]);

  const shouldRender = isFinePointer && isVisible && pendingRequests > 0;

  const style = useMemo(
    () => ({
      left: Math.max(8, cursorX + 14),
      top: Math.max(8, cursorY + 14),
    }),
    [cursorX, cursorY],
  );

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-label="Loading in progress"
      className="pointer-events-none fixed z-[9999]"
      style={style}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-[#e6c2a2] bg-white/95 px-2 py-1 shadow-[0_10px_22px_rgba(153,95,52,0.2)] backdrop-blur">
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e7c6aa] border-t-[#cc7d44]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7a4a27]">Loading</span>
      </div>
    </div>
  );
}
