'use client';

import Link from 'next/link';
import { MapPin, ShoppingBag } from 'lucide-react';
import { type RefObject } from 'react';
import type { User } from '@supabase/supabase-js';
import { IconTooltip } from './IconTooltip';
import { SearchBar } from './SearchBar';
import { LocationEditor } from './LocationEditor';
import { UserMenuDropdown } from './UserMenuDropdown';
import type { AppRole } from './types';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import NotificationDrawer from '@/components/ui/NotificationDrawer';

interface DesktopToolbarProps {
  // search
  searchOpen: boolean;
  searchQuery: string;
  searchRef: RefObject<HTMLDivElement | null>;
  onSearchOpen: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  // location
  locationEditorOpen: boolean;
  locationEditorRef: RefObject<HTMLDivElement | null>;
  pincode: string;
  pincodeDraft: string;
  onLocationToggle: () => void;
  onPincodeDraftChange: (value: string) => void;
  onPincodeSave: () => void;
  // cart
  serviceCartCount: number;
  // auth
  isAuthResolved: boolean;
  authUser: User | null;
  // profile photo
  profilePhotoUrl: string | null;
  profilePhotoLoadFailed: boolean;
  onProfilePhotoError: () => void;
  // profile menu
  profileMenuOpen: boolean;
  desktopProfileMenuRef: RefObject<HTMLDivElement | null>;
  onProfileMenuToggle: () => void;
  // user info
  initials: string;
  displayName: string;
  effectiveRole: AppRole | null;
  profileHref: string;
  settingsHref: string;
  petProfilesHref: string;
  petProfilesLabel: string;
  billingHref: string;
  subscriptionsHref: string;
  addressesHref: string;
  isCustomerAccount: boolean;
  // actions
  isBookingPage: boolean;
  onBookingAnchorClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onProfileMenuClose: () => void;
  onSignOut: () => void;
}

export function DesktopToolbar({
  searchOpen,
  searchQuery,
  searchRef,
  onSearchOpen,
  onSearchQueryChange,
  onSearchSubmit,
  locationEditorOpen,
  locationEditorRef,
  pincode,
  pincodeDraft,
  onLocationToggle,
  onPincodeDraftChange,
  onPincodeSave,
  serviceCartCount,
  isAuthResolved,
  authUser,
  profilePhotoUrl,
  profilePhotoLoadFailed,
  onProfilePhotoError,
  profileMenuOpen,
  desktopProfileMenuRef,
  onProfileMenuToggle,
  initials,
  displayName,
  effectiveRole,
  profileHref,
  settingsHref,
  petProfilesHref,
  petProfilesLabel,
  billingHref,
  subscriptionsHref,
  addressesHref,
  isCustomerAccount,
  isBookingPage,
  onBookingAnchorClick,
  onProfileMenuClose,
  onSignOut,
}: DesktopToolbarProps) {
  return (
    <div className="hidden items-center self-center gap-2.5 lg:flex" ref={desktopProfileMenuRef}>
      {/* Icon cluster pill */}
      <div className="flex items-center gap-1.5 rounded-full border border-[#e7c8ad] bg-[linear-gradient(145deg,rgba(255,250,244,0.95),rgba(255,241,223,0.92))] px-1.5 py-1 shadow-[0_10px_20px_rgba(145,92,54,0.12)]">
        {/* Search */}
        <div className="relative" ref={searchRef}>
          <SearchBar
            searchOpen={searchOpen}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            onOpen={onSearchOpen}
            onSubmit={onSearchSubmit}
          />
        </div>

        {/* Location */}
        <div className="relative" ref={locationEditorRef}>
          <IconTooltip label="Location">
            <button
              type="button"
              onClick={onLocationToggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-ink transition hover:-translate-y-0.5 hover:bg-white/70"
              aria-expanded={locationEditorOpen}
              aria-controls="header-location-editor"
              aria-label={`Edit location pincode. Current pincode ${pincode}`}
            >
              <MapPin className="h-4 w-4 text-coral" aria-hidden="true" />
            </button>
          </IconTooltip>

          {locationEditorOpen ? (
            <LocationEditor
              variant="desktop"
              pincode={pincode}
              pincodeDraft={pincodeDraft}
              onPincodeDraftChange={onPincodeDraftChange}
              onSave={onPincodeSave}
            />
          ) : null}
        </div>

        {/* Cart */}
        <IconTooltip label="Cart">
          <Link
            href="/forms/customer-booking#start-your-booking"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-ink transition hover:-translate-y-0.5 hover:bg-white/70"
            aria-label="View selected services"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {serviceCartCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#1f1a17] px-1 text-[10px] font-semibold text-white">
                {serviceCartCount > 9 ? '9+' : serviceCartCount}
              </span>
            ) : null}
          </Link>
        </IconTooltip>

        {/* Notifications */}
        <IconTooltip label="Notifications">
          <NotificationDrawer isAuthenticated={!!authUser} role={effectiveRole} />
        </IconTooltip>
      </div>

      {/* Book now CTA */}
      {!isBookingPage ? (
        <Link
          href="/forms/customer-booking#start-your-booking"
          className="inline-flex h-10 items-center rounded-full border border-[#dc8f56] bg-[linear-gradient(135deg,#de9158,#c7773b)] px-5 text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(199,119,59,0.27)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#d7864f,#bf6f34)] hover:shadow-[0_14px_24px_rgba(199,119,59,0.32)]"
          aria-label="Go to customer booking page"
          onClick={onBookingAnchorClick}
        >
          Book now
        </Link>
      ) : null}

      {/* Auth area */}
      {isAuthResolved && authUser ? (
        <>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-full border border-[#e7c4a7] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] px-3.5 text-[13px] font-semibold text-ink transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(145deg,#fffaf3,#fff4e8)]"
            aria-label="Open your dashboard"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={onProfileMenuToggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e7c4a7] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] text-sm font-bold text-ink transition hover:bg-[linear-gradient(145deg,#fffaf3,#fff4e8)]"
            aria-label="Open user profile menu"
          >
            {profilePhotoUrl && !profilePhotoLoadFailed ? (
              <span className="relative block h-full w-full overflow-hidden rounded-full">
                <StorageBackedImage
                  value={profilePhotoUrl}
                  bucket="user-photos"
                  alt="Profile"
                  fill
                  sizes="40px"
                  className="object-cover"
                  onError={onProfilePhotoError}
                />
              </span>
            ) : (
              initials
            )}
          </button>

          {profileMenuOpen ? (
            <UserMenuDropdown
              variant="desktop"
              displayName={displayName}
              profileHref={profileHref}
              settingsHref={settingsHref}
              petProfilesHref={petProfilesHref}
              petProfilesLabel={petProfilesLabel}
              billingHref={billingHref}
              subscriptionsHref={subscriptionsHref}
              addressesHref={addressesHref}
              isCustomerAccount={isCustomerAccount}
              effectiveRole={effectiveRole}
              onClose={onProfileMenuClose}
              onSignOut={onSignOut}
            />
          ) : null}
        </>
      ) : isAuthResolved ? (
        <Link
          href="/auth/sign-in"
          className="inline-flex h-10 items-center rounded-full border border-[#e7c4a7] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] px-3.5 text-[13px] font-semibold text-[#2d221a] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[linear-gradient(145deg,#fffaf3,#fff4e8)]"
          aria-label="Log in or create an account"
        >
          Log in / Sign up
        </Link>
      ) : null}
    </div>
  );
}
