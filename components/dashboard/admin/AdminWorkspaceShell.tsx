'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  Command,
  CreditCard,
  FileClock,
  HeartPulse,
  LayoutDashboard,
  Menu,
  ReceiptIndianRupee,
  Search,
  Scissors,
  ShieldCheck,
  Sparkles,
  UsersRound,
  UserRoundCog,
  X,
  type LucideIcon,
} from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { cn } from '@/lib/design-system';
import type { AdminDashboardView } from './AdminDashboardShell';

type AdminNavItem = {
  id: AdminDashboardView;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const navGroups: AdminNavGroup[] = [
  {
    label: 'Operations',
    items: [
      { id: 'overview', label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard, description: 'Business health and alerts' },
      { id: 'bookings', label: 'Bookings', href: '/dashboard/admin/bookings', icon: CalendarDays, description: 'Booking queue and moderation' },
      { id: 'providers', label: 'Providers', href: '/dashboard/admin/providers', icon: UserRoundCog, description: 'Applications and service rollout' },
      { id: 'services', label: 'Services', href: '/dashboard/admin/services', icon: Scissors, description: 'Catalog and discount controls' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'billing', label: 'Billing', href: '/dashboard/admin/billing', icon: ReceiptIndianRupee, description: 'Invoices and collections' },
      { id: 'payments', label: 'Payments', href: '/dashboard/admin/payments', icon: CreditCard, description: 'Transactions and payment state' },
      { id: 'subscriptions', label: 'Subscriptions', href: '/dashboard/admin/subscriptions', icon: Sparkles, description: 'Plans and memberships' },
    ],
  },
  {
    label: 'Identity',
    items: [
      { id: 'users', label: 'Users', href: '/dashboard/admin/users', icon: UsersRound, description: 'Customer and account records' },
      { id: 'access', label: 'Access', href: '/dashboard/admin/access', icon: ShieldCheck, description: 'Admin and staff permissions' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'health', label: 'Health', href: '/dashboard/admin/health', icon: HeartPulse, description: 'Schema and platform checks' },
      { id: 'audit', label: 'Audit Log', href: '/dashboard/admin/audit', icon: FileClock, description: 'Operational history' },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

function findActiveItem(activeView: AdminDashboardView) {
  return navItems.find((item) => item.id === activeView) ?? navItems[0];
}

type AdminWorkspaceShellProps = {
  activeView: AdminDashboardView;
  children: ReactNode;
};

export default function AdminWorkspaceShell({ activeView, children }: AdminWorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const activeItem = findActiveItem(activeView);

  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return navItems;

    return navItems.filter((item) => (
      `${item.label} ${item.description}`.toLowerCase().includes(query)
    ));
  }, [commandQuery]);

  useEffect(() => {
    setMobileNavOpen(false);
    setCommandOpen(false);
    setCommandQuery('');
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isCommandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCommandShortcut) {
        event.preventDefault();
        setCommandOpen(true);
      }

      if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    const frame = window.requestAnimationFrame(() => commandInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [commandOpen]);

  function navigateTo(item: AdminNavItem) {
    router.push(item.href);
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-neutral-200 bg-white">
      <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-3" aria-label="Open admin overview">
          <BrandMark compact />
        </Link>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close admin navigation"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4" aria-label="Admin navigation">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{group.label}</p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeView;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition',
                      active
                        ? 'bg-coral text-white shadow-sm'
                        : 'text-neutral-600 hover:bg-brand-50 hover:text-neutral-950',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-700')} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-neutral-200 p-3">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-left text-xs text-neutral-600 transition hover:border-brand-200 hover:bg-brand-50/40"
        >
          <Search className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          <span className="flex-1">Search admin</span>
          <span className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">⌘K</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">
        {sidebar}
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-950/30"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close admin navigation overlay"
          />
          <div className="relative h-full max-w-[20rem] shadow-xl">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-brand-50 hover:text-coral lg:hidden"
                aria-label="Open admin navigation"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-neutral-500">Admin / {activeItem.label}</p>
                <p className="truncate text-xs font-semibold text-neutral-950">{activeItem.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden min-w-56 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-left text-xs text-neutral-500 transition hover:border-brand-200 hover:bg-brand-50/40 md:flex"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1">Search or jump to...</span>
                <span className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">⌘K</span>
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition hover:bg-brand-50 hover:text-coral"
                aria-label="Open admin notifications"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
              </button>
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-brand-50 hover:text-coral"
              >
                Account
              </Link>
            </div>
          </div>
        </header>

        <div className="px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
          {children}
        </div>
      </div>

      {commandOpen ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-neutral-950/30 px-4 pt-20 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Admin command palette">
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-neutral-200 px-3 py-2.5">
              <Command className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Search admin sections"
                className="h-9 flex-1 border-0 bg-transparent text-xs text-neutral-950 outline-none placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                Esc
              </button>
            </div>
            <div className="max-h-[20rem] overflow-y-auto p-1.5">
              {filteredCommands.length > 0 ? filteredCommands.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-brand-50/50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-coral">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-neutral-950">{item.label}</span>
                      <span className="block truncate text-xs text-neutral-500">{item.description}</span>
                    </span>
                  </button>
                );
              }) : (
                <div className="px-4 py-10 text-center text-sm text-neutral-500">No admin sections found.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
