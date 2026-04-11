'use client';

import React from 'react';

/**
 * Represents a single notification/alert
 */
export interface Notification {
  id: string;
  level: 'info' | 'warning' | 'critical' | 'success';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Props for the NotificationCenter component
 */
export interface NotificationCenterProps {
  /** Array of notifications to display */
  notifications: Notification[];
  /** Optional custom title */
  title?: string;
  /** Optional callback when a notification action is clicked */
  onAction?: (notificationId: string) => void;
}

/**
 * Reusable notification/alert center component
 * 
 * Displays a list of notifications with severity-based styling.
 * Used for system alerts, booking status updates, warnings, etc.
 * 
 * @example
 * ```tsx
 * <NotificationCenter
 *   title="Notifications"
 *   notifications={[
 *     { id: '1', level: 'info', message: 'Booking confirmed' },
 *     { id: '2', level: 'warning', message: 'Payment pending' },
 *   ]}
 * />
 * ```
 */
export default function NotificationCenter({
  notifications,
  title = 'Notification Center',
  onAction,
}: NotificationCenterProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-[#e8ccb3] bg-white p-6 shadow-premium-md">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <ul className="mt-4 grid gap-2 text-sm">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={`rounded-xl border p-3 transition ${
              notification.level === 'critical'
                ? 'border-red-200 bg-red-50 text-red-700'
                : notification.level === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : notification.level === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-[#e8ccb3] bg-[#fff9f3] text-[#6b6b6b]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p>{notification.message}</p>
              {notification.action && (
                <button
                  type="button"
                  onClick={() => {
                    notification.action?.onClick();
                    onAction?.(notification.id);
                  }}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80 ${
                    notification.level === 'critical'
                      ? 'bg-red-100 text-red-700'
                      : notification.level === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : notification.level === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-[#fff4e6] text-[#6b6b6b]'
                  }`}
                >
                  {notification.action.label}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
