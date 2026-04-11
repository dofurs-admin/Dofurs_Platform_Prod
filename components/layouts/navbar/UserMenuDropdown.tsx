'use client';

import Link from 'next/link';
import { UserRound, LogOut, Settings, MapPin, ReceiptIndianRupee, Wallet } from 'lucide-react';
import type { AppRole } from './types';

interface UserMenuDropdownProps {
  variant: 'desktop' | 'mobile';
  displayName: string;
  profileHref: string;
  settingsHref: string;
  petProfilesHref: string;
  petProfilesLabel: string;
  billingHref: string;
  subscriptionsHref: string;
  addressesHref: string;
  isCustomerAccount: boolean;
  effectiveRole: AppRole | null;
  onClose: () => void;
  onSignOut: () => void;
}

export function UserMenuDropdown({
  variant,
  displayName,
  profileHref,
  settingsHref,
  billingHref,
  subscriptionsHref,
  addressesHref,
  isCustomerAccount,
  onClose,
  onSignOut,
}: UserMenuDropdownProps) {
  if (variant === 'desktop') {
    return (
      <div className="absolute right-4 top-14 z-[42] w-64 rounded-2xl border border-[#e7c4a7] bg-[linear-gradient(160deg,#fff8f0,#fff2e2)] p-2 shadow-soft-md">
        <div className="rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-ink">{displayName}</div>
        <Link
          href={profileHref}
          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-white/65"
          onClick={onClose}
        >
          <UserRound className="h-4 w-4" />
          Profile
        </Link>
        <Link
          href={settingsHref}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-white/65"
          onClick={onClose}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        {isCustomerAccount ? (
          <>
            <Link
              href={billingHref}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-white/65"
              onClick={onClose}
            >
              <ReceiptIndianRupee className="h-4 w-4" />
              Billing and Invoices
            </Link>
            <Link
              href={subscriptionsHref}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-white/65"
              onClick={onClose}
            >
              <Wallet className="h-4 w-4" />
              Subscriptions and Credits
            </Link>
            <Link
              href={addressesHref}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-white/65"
              onClick={onClose}
            >
              <MapPin className="h-4 w-4" />
              Manage Addresses
            </Link>
          </>
        ) : null}
        <button
          type="button"
          onClick={onSignOut}
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-white/65"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    );
  }

  // mobile variant
  return (
    <div className="absolute right-0 top-[calc(100%+0.45rem)] z-[42] w-[min(17.5rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-[#e7c4a7]/80 bg-[linear-gradient(170deg,rgba(255,248,240,0.96),rgba(255,242,226,0.94))] p-1.5 shadow-[0_16px_30px_rgba(125,79,46,0.22)] backdrop-blur-md">
      <div className="rounded-xl bg-white/62 px-3 py-2 text-sm font-semibold text-ink">{displayName}</div>
      <Link
        href={profileHref}
        className="mt-1 flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink transition hover:bg-white/60"
        onClick={onClose}
      >
        <UserRound className="h-4 w-4" />
        Profile
      </Link>
      <Link
        href={settingsHref}
        className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink transition hover:bg-white/60"
        onClick={onClose}
      >
        <Settings className="h-4 w-4" />
        Settings
      </Link>
      {isCustomerAccount ? (
        <>
          <Link
            href={billingHref}
            className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink transition hover:bg-white/60"
            onClick={onClose}
          >
            <ReceiptIndianRupee className="h-4 w-4" />
            Billing and Invoices
          </Link>
          <Link
            href={subscriptionsHref}
            className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink transition hover:bg-white/60"
            onClick={onClose}
          >
            <Wallet className="h-4 w-4" />
            Subscriptions and Credits
          </Link>
          <Link
            href={addressesHref}
            className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink transition hover:bg-white/60"
            onClick={onClose}
          >
            <MapPin className="h-4 w-4" />
            Manage Addresses
          </Link>
        </>
      ) : null}
      <button
        type="button"
        onClick={onSignOut}
        className="mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink transition hover:bg-white/60"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
