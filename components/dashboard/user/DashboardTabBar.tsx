'use client';

import Link from 'next/link';
import type { UserDashboardView } from './types';

const TABS: Array<{ key: UserDashboardView; label: string; href: string }> = [
  { key: 'home', label: 'Home', href: '/dashboard/user?view=home' },
  { key: 'bookings', label: 'Bookings', href: '/dashboard/user?view=bookings' },
  { key: 'pets', label: 'Pets', href: '/dashboard/user?view=pets' },
  { key: 'account', label: 'Account', href: '/dashboard/user?view=account' },
];

type Props = {
  view: UserDashboardView;
};

export default function DashboardTabBar({ view }: Props) {
  return (
    <>
      {/* ===== DESKTOP TAB BAR ===== */}
      <div className="hidden overflow-x-auto border-b border-neutral-200 sm:block">
        <div className="flex min-w-max gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex items-center whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-all duration-150 ease-out ${
                view === tab.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ===== MOBILE TAB BAR ===== */}
      <div className="flex gap-1 rounded-xl border border-brand-100/60 bg-white/80 p-1 shadow-sm sm:hidden">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-all duration-200 ${
              view === tab.key
                ? 'bg-[linear-gradient(135deg,#e49a57,#cf8347)] text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </>
  );
}
