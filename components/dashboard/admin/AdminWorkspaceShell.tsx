'use client';

import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Command,
  CreditCard,
  FileClock,
  GripVertical,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptIndianRupee,
  Search,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
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

const SIDEBAR_STORAGE_KEY = 'dofurs-admin-sidebar-layout';
const SIDEBAR_DEFAULT_WIDTH = 256;
const SIDEBAR_MIN_WIDTH = 224;
const SIDEBAR_MAX_WIDTH = 384;
const SIDEBAR_COLLAPSED_WIDTH = 72;

function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSigningOut, startSignOutTransition] = useTransition();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarResizeStartRef = useRef({ x: 0, width: SIDEBAR_DEFAULT_WIDTH });
  const activeItem = findActiveItem(activeView);
  const activeSidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth;

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
    setAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (!storedValue) return;

      const storedLayout = JSON.parse(storedValue) as { collapsed?: unknown; width?: unknown };
      if (typeof storedLayout.width === 'number') {
        setSidebarWidth(clampSidebarWidth(storedLayout.width));
      }

      if (typeof storedLayout.collapsed === 'boolean') {
        setSidebarCollapsed(storedLayout.collapsed);
      }
    } catch {
      // Ignore malformed local storage and keep the default workspace layout.
    } finally {
      setSidebarReady(true);
    }
  }, []);

  useEffect(() => {
    shellRef.current?.style.setProperty('--admin-sidebar-width', `${activeSidebarWidth}px`);
  }, [activeSidebarWidth]);

  useEffect(() => {
    if (!sidebarReady) return;

    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        JSON.stringify({ collapsed: sidebarCollapsed, width: sidebarWidth }),
      );
    } catch {
      // Workspace preferences are non-critical.
    }
  }, [sidebarCollapsed, sidebarReady, sidebarWidth]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handlePointerMove(event: globalThis.PointerEvent) {
      const resizeDelta = event.clientX - sidebarResizeStartRef.current.x;
      setSidebarWidth(clampSidebarWidth(sidebarResizeStartRef.current.width + resizeDelta));
    }

    function stopResizing() {
      setIsResizingSidebar(false);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const isCommandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCommandShortcut) {
        event.preventDefault();
        setCommandOpen(true);
      }

      if (event.key === 'Escape') {
        setCommandOpen(false);
        setAccountMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!commandOpen) return;
    const frame = window.requestAnimationFrame(() => commandInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [commandOpen]);

  function navigateTo(item: AdminNavItem) {
    router.push(item.href);
  }

  function handleSignOut() {
    startSignOutTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAccountMenuOpen(false);
      router.replace('/auth/sign-in?mode=signin');
      router.refresh();
    });
  }

  const adminAccountLinks = [
    { href: '/dashboard/admin', label: 'Profile', icon: UserRound },
    { href: '/dashboard/admin/access', label: 'Settings', icon: Settings },
    { href: '/dashboard/admin/users', label: 'User Directory', icon: UsersRound },
  ];

  function beginSidebarResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (sidebarCollapsed || event.button !== 0) return;

    event.preventDefault();
    sidebarResizeStartRef.current = { x: event.clientX, width: sidebarWidth };
    setIsResizingSidebar(true);
  }

  function handleSidebarResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (sidebarCollapsed) return;

    const step = event.shiftKey ? 32 : 16;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSidebarWidth((currentWidth) => clampSidebarWidth(currentWidth - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSidebarWidth((currentWidth) => clampSidebarWidth(currentWidth + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MIN_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSidebarWidth(SIDEBAR_MAX_WIDTH);
    }
  }

  function renderSidebar(variant: 'desktop' | 'mobile') {
    const isDesktop = variant === 'desktop';
    const isCollapsed = isDesktop && sidebarCollapsed;

    return (
      <aside className="relative flex h-full w-full flex-col border-r border-neutral-200 bg-white">
        <div className={cn(
          'flex h-14 items-center border-b border-neutral-200',
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}>
          {isCollapsed ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-brand-50 hover:text-coral"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expand admin navigation"
              title="Expand navigation"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <>
              <Link href="/dashboard/admin" className="inline-flex min-w-0 items-center gap-3" aria-label="Open admin overview">
                <BrandMark compact />
              </Link>
              <div className="flex items-center gap-1">
                {isDesktop ? (
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-brand-50 hover:text-coral"
                    onClick={() => setSidebarCollapsed(true)}
                    aria-label="Collapse admin navigation to icons"
                    aria-pressed={sidebarCollapsed}
                    title="Collapse to icons"
                  >
                    <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 lg:hidden"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close admin navigation"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>

        <nav className={cn('flex-1 overflow-y-auto py-4', isCollapsed ? 'space-y-2 px-2' : 'space-y-4 px-2.5')} aria-label="Admin navigation">
          {navGroups.map((group, groupIndex) => (
            <div
              key={group.label}
              className={cn(
                isCollapsed && groupIndex > 0 ? 'border-t border-neutral-100 pt-2' : null,
              )}
            >
              {isCollapsed ? null : (
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{group.label}</p>
              )}
              <div className={cn(isCollapsed ? 'space-y-1' : 'mt-2 space-y-1')}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeView;

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        'group flex items-center rounded-lg text-xs font-medium transition',
                        isCollapsed ? 'h-10 justify-center px-0' : 'gap-2.5 px-2.5 py-2',
                        active
                          ? 'bg-coral text-white shadow-sm'
                          : 'text-neutral-600 hover:bg-brand-50 hover:text-neutral-950',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-700')} aria-hidden="true" />
                      {isCollapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn('border-t border-neutral-200', isCollapsed ? 'p-2' : 'p-3')}>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className={cn(
              'flex w-full items-center rounded-lg border border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-600 transition hover:border-brand-200 hover:bg-brand-50/40',
              isCollapsed ? 'h-10 justify-center px-0' : 'gap-2.5 px-2.5 py-2',
            )}
            title={isCollapsed ? 'Search admin' : undefined}
          >
            <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
            {isCollapsed ? (
              <span className="sr-only">Search admin</span>
            ) : (
              <>
                <span className="flex-1">Search admin</span>
                <span className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">⌘K</span>
              </>
            )}
          </button>
        </div>

        {isDesktop && !isCollapsed ? (
          <div
            role="separator"
            aria-label="Resize admin navigation"
            aria-orientation="vertical"
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            title="Drag to resize navigation"
            onPointerDown={beginSidebarResize}
            onKeyDown={handleSidebarResizeKeyDown}
            className={cn(
              'absolute inset-y-0 -right-1 hidden w-3 cursor-col-resize items-center justify-center outline-none transition lg:flex',
              'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition',
              'hover:after:bg-coral/50 focus-visible:after:bg-coral',
              isResizingSidebar ? 'after:bg-coral' : null,
            )}
          >
            <span className="flex h-8 w-4 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-sm transition hover:text-coral">
              <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        ) : null}
      </aside>
    );
  }

  return (
    <div
      ref={shellRef}
      className={cn(
        'min-h-screen bg-neutral-50 text-neutral-950 [--admin-sidebar-width:16rem]',
        isResizingSidebar ? 'select-none' : null,
      )}
    >
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-[var(--admin-sidebar-width)]">
        {renderSidebar('desktop')}
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
            {renderSidebar('mobile')}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[var(--admin-sidebar-width)]">
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
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  className={cn(
                    'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-brand-50 hover:text-coral',
                    accountMenuOpen ? 'border-brand-200 bg-brand-50/60 text-coral' : null,
                  )}
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                >
                  Account
                  <ChevronDown className={cn('h-3.5 w-3.5 transition', accountMenuOpen ? 'rotate-180' : null)} aria-hidden="true" />
                </button>

                {accountMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl" role="menu" aria-label="Admin account options">
                    <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Admin Account</div>
                    {adminAccountLinks.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-neutral-700 transition hover:bg-brand-50 hover:text-neutral-950"
                          role="menuitem"
                        >
                          <Icon className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                    <div className="my-1 border-t border-neutral-100" />
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                      {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </button>
                  </div>
                ) : null}
              </div>
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
