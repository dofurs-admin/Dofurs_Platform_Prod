'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { CalendarSearch, House, LayoutDashboard, LifeBuoy, Newspaper } from 'lucide-react';

type MobileNavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: ComponentType<{ className?: string }>;
};

const navItems: MobileNavItem[] = [
  {
    href: '/',
    label: 'Home',
    match: (pathname) => pathname === '/',
    icon: House,
  },
  {
    href: '/forms/customer-booking#start-your-booking',
    label: 'Book',
    match: (pathname) => pathname.startsWith('/forms/customer-booking'),
    icon: CalendarSearch,
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    match: (pathname) => pathname.startsWith('/dashboard'),
    icon: LayoutDashboard,
  },
  {
    href: '/blog',
    label: 'Blog',
    match: (pathname) => pathname.startsWith('/blog'),
    icon: Newspaper,
  },
  {
    href: '/contact-us',
    label: 'Support',
    match: (pathname) => pathname.startsWith('/contact-us') || pathname.startsWith('/faqs'),
    icon: LifeBuoy,
  },
];

function isNavHidden(pathname: string) {
  return pathname.startsWith('/auth');
}

export default function MobileBottomNav() {
  const pathname = usePathname() || '/';
  const dashboardHref = pathname.startsWith('/dashboard/user')
    ? '/dashboard/user?view=operations'
    : pathname.startsWith('/dashboard/provider')
      ? '/dashboard/provider?view=operations'
      : pathname.startsWith('/dashboard/admin')
        ? '/dashboard/admin?view=bookings'
        : '/dashboard';

  if (isNavHidden(pathname)) {
    return null;
  }

  return (
    <nav
      className="dofurs-mobile-bottom-nav fixed inset-x-0 z-[45] lg:hidden"
      aria-label="Mobile app navigation"
    >
      <div className="grid grid-cols-5 gap-1 rounded-[1.2rem] border border-white/70 bg-[linear-gradient(165deg,rgba(255,255,255,0.82),rgba(255,248,241,0.72)_58%,rgba(255,244,234,0.7))] px-1.5 py-1 shadow-[0_12px_24px_rgba(94,58,30,0.14)] backdrop-blur-[14px]">
        {navItems.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const href = item.label === 'Dashboard' ? dashboardHref : item.href;

          return (
            <Link
              key={item.label}
              href={href}
              className={`group inline-flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[0.85rem] px-1 text-[10px] font-medium leading-none tracking-[0.01em] transition-all duration-300 ${
                active
                  ? 'bg-white/72 text-[#734a2f] shadow-[0_8px_16px_rgba(126,83,49,0.15)]'
                  : 'text-[#7b5d47] hover:bg-white/70'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ${
                  active ? 'bg-[#f6e9dc]' : 'bg-white/75 group-hover:bg-white'
                }`}
              >
                <Icon className={`h-[0.92rem] w-[0.92rem] transition-transform duration-300 ${active ? 'scale-105' : 'group-hover:-translate-y-0.5'}`} />
              </span>
              <span className="whitespace-nowrap text-[10px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
