'use client';

import Link from 'next/link';

const ACCOUNT_LINKS = [
  {
    href: '/refer-and-earn',
    icon: '🎁',
    title: 'Refer & Earn',
    description: 'Share your code and earn ₹500 credits per referral',
    accent: 'border-orange-200 bg-orange-50/60',
  },
  {
    href: '/dashboard/user/subscriptions',
    icon: '⭐',
    title: 'Subscriptions',
    description: 'View your active plan and service credits',
    accent: 'border-amber-200 bg-amber-50/60',
  },
  {
    href: '/dashboard/user/billing',
    icon: '🧾',
    title: 'Billing & Invoices',
    description: 'Download invoices and review payment history',
    accent: 'border-brand-200 bg-brand-50/50',
  },
  {
    href: '/dashboard/user/addresses',
    icon: '📍',
    title: 'Saved Addresses',
    description: 'Manage home and pickup locations',
    accent: 'border-emerald-200 bg-emerald-50/50',
  },
  {
    href: '/dashboard/user/profile',
    icon: '👤',
    title: 'Profile',
    description: 'Update your name, email, and contact details',
    accent: 'border-neutral-200 bg-neutral-50/60',
  },
  {
    href: '/dashboard/user/settings',
    icon: '⚙️',
    title: 'Settings',
    description: 'Notification preferences and account options',
    accent: 'border-neutral-200 bg-neutral-50/60',
  },
];

export default function AccountTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-page-title">Account Settings</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Manage your billing, payment methods, addresses, and subscription.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-start gap-4 rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md ${item.accent}`}
          >
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-semibold text-neutral-900 group-hover:text-coral">{item.title}</p>
              <p className="mt-0.5 text-xs text-neutral-600">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
