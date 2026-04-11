'use client';

import React, { ReactNode } from 'react';

/**
 * Represents a single metric/stat card in the summary section
 */
export interface SummaryCardData {
  id: string;
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

/**
 * Navigation tab for view switching (e.g., Overview, Operations, Profile)
 */
export interface NavigationTab {
  id: string;
  label: string;
  href: string;
  isActive: boolean;
}

/**
 * Action item for the action bar (buttons, filters, etc)
 */
export interface ActionBarItem {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}

/**
 * Alert notification with severity levels
 */
export interface DashboardAlert {
  id: string;
  level: 'info' | 'warning' | 'critical' | 'success';
  message: string;
}

/**
 * Main layout configuration for dashboard pages
 */
export interface DashboardLayoutProps {
  /** Header section */
  header: {
    title: string;
    subtitle?: string;
    /** Navigation tabs for view switching */
    tabs?: NavigationTab[];
  };

  /** Alerts/notifications (typically after header) */
  alerts?: DashboardAlert[];

  /** Summary cards grid - typically metrics/insights (SM: 2 cols, grid-cols-3, XL: 4 cols) */
  summaryCards?: SummaryCardData[];

  /** Main content area - primary content for the view */
  children: ReactNode;

  /** Optional action bar - secondary controls, filters, pagination */
  actionBar?: {
    position?: 'top' | 'bottom' | 'both';
    children: ReactNode;
  };

  /** Optional sidebar - for filters, navigation, or related content */
  sidebar?: {
    position?: 'left' | 'right';
    title?: string;
    children: ReactNode;
  };

  /** Optional loading state - shows skeleton if true */
  isLoading?: boolean;

  /** Optional empty state message */
  emptyMessage?: string;
}

/**
 * Reusable dashboard layout component with standardized structure
 * 
 * Provides consistent layout across Admin, Provider, and Owner dashboards
 * with support for header, alerts, summary cards, main content, action bar, and sidebar.
 * 
 * @example
 * ```tsx
 * <DashboardLayout
 *   header={{
 *     title: "User Dashboard",
 *     subtitle: "Manage your bookings and pet profiles",
 *     tabs: [
 *       { id: 'overview', label: 'Overview', href: '/dashboard/user', isActive: true },
 *       { id: 'profile', label: 'Profile', href: '/dashboard/user?view=profile', isActive: false },
 *     ]
 *   }}
 *   alerts={[
 *     { id: '1', level: 'info', message: 'Your booking is confirmed' }
 *   ]}
 *   summaryCards={[
 *     { id: '1', title: 'Active Bookings', value: 3, trend: 'up' },
 *     { id: '2', title: 'Completed', value: 12, trend: 'neutral' },
 *   ]}
 *   actionBar={{
 *     position: 'top',
 *     children: <BookingFilters />
 *   }}
 * >
 *   <BookingsList />
 * </DashboardLayout>
 * ```
 */
export default function DashboardLayout({
  header,
  alerts,
  summaryCards,
  children,
  actionBar,
  sidebar,
}: DashboardLayoutProps) {
  return (
    <div className="flex flex-col gap-5 text-ink">
      {/* Header Section */}
      <section className="rounded-3xl border border-[#e6c8ad] bg-[linear-gradient(140deg,#fff4e4_0%,#fffdf9_52%,#ffe9d2_100%)] p-4 shadow-premium-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{header.title}</h1>
            {header.subtitle && (
              <p className="mt-1 text-sm text-[#6b6b6b]">{header.subtitle}</p>
            )}
          </div>

          {/* Navigation Tabs */}
          {header.tabs && header.tabs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {header.tabs.map((tab) => (
                <a
                  key={tab.id}
                  href={tab.href}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    tab.isActive
                      ? 'border-[#ddb996] bg-white/85 text-ink'
                      : 'border-[#e8ccb3] bg-white/80 text-[#6b6b6b] hover:bg-white hover:text-ink'
                  }`}
                >
                  {tab.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Alerts Section */}
      {alerts && alerts.length > 0 && (
        <section className="rounded-3xl border border-[#e8ccb3] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f1_100%)] p-6 shadow-premium-md">
          <h2 className="text-lg font-semibold text-ink">Notifications</h2>
          <ul className="mt-4 grid gap-2 text-sm">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`rounded-xl border p-3 ${
                  alert.level === 'critical'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : alert.level === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : alert.level === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-[#f2dfcf] bg-[#fffdfa] text-[#6b6b6b]'
                }`}
              >
                {alert.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Summary Cards Section */}
      {summaryCards && summaryCards.length > 0 && (
        <section className="rounded-3xl border border-[#e8ccb3] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f1_100%)] p-6 shadow-premium-md">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 text-sm">
            {summaryCards.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-[#ecd5c2] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:shadow-premium"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[#6b6b6b] uppercase">{card.title}</h3>
                  {card.trend && (
                    <span
                      className={`text-xs font-semibold ${
                        card.trend === 'up'
                          ? 'text-emerald-600'
                          : card.trend === 'down'
                            ? 'text-red-600'
                            : 'text-[#6b6b6b]'
                      }`}
                    >
                      {card.trend === 'up' ? '↑' : card.trend === 'down' ? '↓' : '–'}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-lg font-bold text-ink">{card.value}</p>
                {card.description && (
                  <p className="mt-1 text-[11px] text-[#6b6b6b]">{card.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Action Bar */}
      {actionBar && actionBar.position !== 'bottom' && (
        <div className="rounded-3xl border border-[#e8ccb3] bg-white/95 p-6 shadow-premium-md">
          {actionBar.children}
        </div>
      )}

      {/* Main Content Area with Optional Sidebar */}
      <div className={`grid gap-5 ${sidebar ? 'md:grid-cols-3 lg:grid-cols-4' : ''}`}>
        <div className={sidebar ? 'md:col-span-2 lg:col-span-3' : ''}>
          {children}
        </div>

        {/* Sidebar */}
        {sidebar && (
          <aside className="h-fit rounded-3xl border border-[#e8ccb3] bg-white/95 p-6 shadow-premium-md">
            {sidebar.title && (
              <h3 className="font-semibold text-ink mb-4">{sidebar.title}</h3>
            )}
            {sidebar.children}
          </aside>
        )}
      </div>

      {/* Bottom Action Bar */}
      {actionBar && (actionBar.position === 'bottom' || actionBar.position === 'both') && (
        <div className="rounded-3xl border border-[#e8ccb3] bg-white/95 p-6 shadow-premium-md">
          {actionBar.children}
        </div>
      )}
    </div>
  );
}
