'use client';

import { useState, useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { Bell, X, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

type AppRole = 'user' | 'provider' | 'admin' | 'staff';

type NotificationType =
  | 'booking_created'
  | 'booking_status_changed'
  | 'pet_added'
  | 'message_received'
  | 'referral_welcome_credit'
  | 'referral_reward_credited';

type ApiNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  time: string;
  type: string;
  href: string;
  isUrgent: boolean;
  isUnread: boolean;
};

type Props = {
  isAuthenticated: boolean;
  role?: AppRole | null;
};

const NOTIFICATION_POLL_INTERVAL_MS = 60_000;

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  booking_created: Calendar,
  booking_status_changed: CheckCircle,
  pet_added: Bell,
  message_received: AlertCircle,
  referral_welcome_credit: Bell,
  referral_reward_credited: CheckCircle,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  booking_created: 'text-blue-600',
  booking_status_changed: 'text-green-600',
  pet_added: 'text-coral',
  message_received: 'text-amber-600',
  referral_welcome_credit: 'text-coral',
  referral_reward_credited: 'text-green-600',
};

function isKnownNotificationType(type: string): type is NotificationType {
  return type in TYPE_ICON;
}

function formatRelativeTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const today = new Date();
  const diffMs = today.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function getNumberFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getNotificationHref(notification: ApiNotification, role: AppRole | null): string {
  const bookingId = getNumberFromUnknown(notification.data?.booking_id);

  if (role === 'provider') {
    return bookingId
      ? `/dashboard/provider?view=operations&booking=${bookingId}`
      : '/dashboard/provider?view=operations';
  }

  if (role === 'admin' || role === 'staff') {
    return bookingId
      ? `/dashboard/admin?tab=bookings&booking=${bookingId}`
      : '/dashboard/admin?tab=bookings';
  }

  if (notification.type === 'message_received') {
    return '/dashboard/user?view=bookings';
  }

  if (notification.type === 'referral_welcome_credit' || notification.type === 'referral_reward_credited') {
    return '/refer-and-earn';
  }

  return bookingId
    ? `/dashboard/user?view=bookings&booking=${bookingId}`
    : '/dashboard/user?view=bookings';
}

function deriveNotifications(source: ApiNotification[], role: AppRole | null): NotificationItem[] {
  const isOperationsRole = role === 'provider' || role === 'admin' || role === 'staff';

  return source
    .map((notification) => {
      const isUnread = !notification.read_at;
      return {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        time: formatRelativeTime(notification.created_at),
        type: notification.type,
        href: getNotificationHref(notification, role),
        isUrgent: isOperationsRole && isUnread && notification.type === 'booking_created',
        isUnread,
      };
    })
    .sort((a, b) => {
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      if (a.isUnread !== b.isUnread) return a.isUnread ? -1 : 1;
      return b.id - a.id;
    })
    .slice(0, 12);
}

export default function NotificationDrawer({ isAuthenticated, role }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isOperationsRole = role === 'provider' || role === 'admin' || role === 'staff';
  const urgentCount = notifications.filter((n) => n.isUrgent).length;
  const badgeCount = isOperationsRole ? urgentCount : unreadCount;

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);

    try {
      const res = await fetch('/api/notifications?limit=30', { cache: 'no-store' });
      if (!res.ok) return;

      const data = (await res.json()) as { notifications?: ApiNotification[]; unreadCount?: number };
      const latest = data.notifications ?? [];
      setNotifications(deriveNotifications(latest, role ?? null));
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch (err) { console.error(err);
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, role]);

  const markNotificationRead = useCallback(async (notificationId: number) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        keepalive: true,
      });

      if (!res.ok) return;

      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, isUnread: false, isUrgent: false } : item)),
      );
      setUnreadCount((current) => (current > 0 ? current - 1 : 0));
    } catch {
      // silently fail
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'mark_all_read' }),
        keepalive: true,
      });

      if (!res.ok) return;

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isUnread: false,
          isUrgent: false,
        })),
      );
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }, []);

  // Keep badge count hydrated without requiring the drawer to open first.
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    void fetchNotifications();
  }, [fetchNotifications, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, NOTIFICATION_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchNotifications, isAuthenticated]);

  const handleOpen = useCallback(async () => {
    setIsOpen(true);
    await fetchNotifications();

    // For user role, treat opening the drawer as reading notifications.
    if (!isOperationsRole) {
      await markAllNotificationsRead();
    }
  }, [fetchNotifications, isOperationsRole, markAllNotificationsRead]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleNotificationClick = useCallback(async (
    event: ReactMouseEvent<HTMLAnchorElement>,
    notification: NotificationItem,
  ) => {
    event.preventDefault();

    if (notification.isUnread) {
      await markNotificationRead(notification.id);
    }

    handleClose();
    router.push(notification.href);
  }, [handleClose, markNotificationRead, router]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: globalThis.MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, handleClose]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Open notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-ink transition hover:-translate-y-0.5 hover:bg-white/70"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {isMounted
        ? createPortal(
            <>
              {/* Backdrop */}
              {isOpen && (
                <div
                  className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px] transition-opacity"
                  aria-hidden="true"
                />
              )}

              {/* Drawer */}
              <div
                ref={drawerRef}
                className={`fixed inset-y-0 right-0 z-[71] flex w-full max-w-sm flex-col bg-[linear-gradient(170deg,#fffdfb_0%,#fffaf6_100%)] shadow-2xl transition-transform duration-300 ${
                  isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                role="dialog"
                aria-label="Notification center"
                aria-modal="true"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#e7c4a7] px-5 py-4">
                  <div>
                    <p className="font-bold text-neutral-950">Notifications</p>
                    {isOperationsRole && urgentCount > 0 && (
                      <p className="text-xs text-red-600 font-medium">{urgentCount} need action</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close notifications"
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100"
                  >
                    <X className="h-4 w-4 text-neutral-600" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-coral border-t-transparent" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <Bell className="h-10 w-10 text-neutral-200" />
                      <p className="font-medium text-neutral-600">No notifications</p>
                      <p className="text-sm text-neutral-400">You&apos;re all caught up!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {notifications.map((n) => {
                        const Icon = isKnownNotificationType(n.type) ? TYPE_ICON[n.type] : Bell;
                        const colorClass = isKnownNotificationType(n.type) ? TYPE_COLOR[n.type] : 'text-neutral-500';

                        return (
                          <Link
                            key={n.id}
                            href={n.href}
                            onClick={(event) => {
                              void handleNotificationClick(event, n);
                            }}
                            className={`flex gap-3 px-5 py-4 transition hover:bg-neutral-50 ${n.isUrgent && isOperationsRole ? 'bg-amber-50/60' : ''} ${n.isUnread ? 'bg-coral/5' : ''}`}
                          >
                            <div className={`mt-0.5 shrink-0 ${colorClass}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold ${n.isUrgent && isOperationsRole ? 'text-amber-800' : 'text-neutral-900'}`}>
                                {n.title}
                                {n.isUrgent && isOperationsRole && (
                                  <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                    ACTION
                                  </span>
                                )}
                                {n.isUnread && (
                                  <span className="ml-2 rounded-full bg-coral/20 px-1.5 py-0.5 text-[10px] font-bold text-coral">
                                    NEW
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-neutral-500">{n.body}</p>
                              <p className="mt-1 text-[10px] font-medium text-neutral-400 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {n.time}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-neutral-100 px-5 py-4">
                  <Link
                    href={role === 'provider' ? '/dashboard/provider' : '/dashboard/user?view=bookings'}
                    onClick={handleClose}
                    className="block w-full rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] py-2.5 text-center text-sm font-bold text-white shadow-sm"
                  >
                    View All Bookings
                  </Link>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
