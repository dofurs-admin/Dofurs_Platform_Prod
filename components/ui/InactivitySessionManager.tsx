'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { INACTIVITY_COOKIE_NAME, getInactivityTimeoutMs } from '@/lib/auth/inactivity';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'click',
  'keydown',
  'mousemove',
  'scroll',
  'touchstart',
];

const REFRESH_INTERVAL_MS = 15_000;
const IDLE_CHECK_INTERVAL_MS = 30_000;
const LAST_ACTIVITY_STORAGE_KEY = 'dofurs:last-activity-at';
const FORCE_LOGOUT_STORAGE_KEY = 'dofurs:force-logout-at';

function getStoredLastActivityAt() {
  const cookieValue = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${INACTIVITY_COOKIE_NAME}=`))
    ?.split('=')[1];

  const localStorageValue = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);

  const parsedCookie = Number(cookieValue ?? '0');
  const parsedStorage = Number(localStorageValue ?? '0');

  const cookieTimestamp = Number.isFinite(parsedCookie) ? parsedCookie : 0;
  const storageTimestamp = Number.isFinite(parsedStorage) ? parsedStorage : 0;

  return Math.max(cookieTimestamp, storageTimestamp);
}

function setLastActivityCookie(timestampMs: number) {
  const maxAgeSeconds = 60 * 60 * 24 * 30;
  const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${INACTIVITY_COOKIE_NAME}=${timestampMs}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
  localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestampMs));
}

export default function InactivitySessionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const hasLoggedOutRef = useRef(false);
  const lastPersistedAtRef = useRef(0);

  useEffect(() => {
    if (pathname.startsWith('/auth')) {
      return;
    }

    const now = Date.now();
    setLastActivityCookie(now);
    lastPersistedAtRef.current = now;

    function persistActivity() {
      const timestamp = Date.now();

      if (timestamp - lastPersistedAtRef.current < REFRESH_INTERVAL_MS) {
        return;
      }

      setLastActivityCookie(timestamp);
      lastPersistedAtRef.current = timestamp;
    }

    async function forceLogout() {
      if (hasLoggedOutRef.current) {
        return;
      }

      hasLoggedOutRef.current = true;
      localStorage.setItem(FORCE_LOGOUT_STORAGE_KEY, String(Date.now()));

      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          keepalive: true,
          cache: 'no-store',
        });
      } catch (err) { console.error(err);
      }

      try {
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch (err) { console.error(err);
      }

      document.cookie = `${INACTIVITY_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
      localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      router.replace('/auth/sign-in?reason=inactive');
      router.refresh();
    }

    function evaluateIdleState() {
      const lastActivityAt = getStoredLastActivityAt();
      if (!lastActivityAt) {
        return;
      }

      if (Date.now() - lastActivityAt > getInactivityTimeoutMs()) {
        void forceLogout();
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key === FORCE_LOGOUT_STORAGE_KEY && event.newValue) {
        void forceLogout();
      }

      if (event.key === LAST_ACTIVITY_STORAGE_KEY && event.newValue) {
        const timestamp = Number(event.newValue);
        if (Number.isFinite(timestamp) && timestamp > lastPersistedAtRef.current) {
          setLastActivityCookie(timestamp);
          lastPersistedAtRef.current = timestamp;
        }
      }
    }

    const intervalId = window.setInterval(evaluateIdleState, IDLE_CHECK_INTERVAL_MS);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', persistActivity, { passive: true });

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, persistActivity, { passive: true });
    }

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', persistActivity);

      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, persistActivity);
      }
    };
  }, [pathname, router]);

  return null;
}
