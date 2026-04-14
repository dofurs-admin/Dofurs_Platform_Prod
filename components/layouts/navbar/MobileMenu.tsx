'use client';

import Link from 'next/link';
import { ChevronDown, MapPin, Search, ShoppingBag } from 'lucide-react';
import { type RefObject } from 'react';
import type { User } from '@supabase/supabase-js';
import { theme } from '@/lib/theme';
import { footerInfoLinks, footerPolicyLinks, links, navServiceItems } from '@/lib/site-data';
import { LocationEditor } from './LocationEditor';
import type { SecondaryMenuKey } from './types';

interface MobileMenuProps {
  mobileNavigationRef: RefObject<HTMLDivElement | null>;
  // search
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  // location
  locationEditorOpen: boolean;
  pincode: string;
  pincodeDraft: string;
  onLocationToggle: () => void;
  onPincodeDraftChange: (value: string) => void;
  onPincodeSave: () => void;
  // cart
  serviceCartCount: number;
  // secondary menus
  secondaryMenuOpen: SecondaryMenuKey | null;
  onSecondaryMenuToggle: (key: SecondaryMenuKey) => void;
  onSecondaryMenuClose: () => void;
  // booking
  isBookingPage: boolean;
  onBookingAnchorClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  // auth
  authUser: User | null;
  isAuthResolved: boolean;
  // close
  onClose: () => void;
}

export function MobileMenu({
  mobileNavigationRef,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  locationEditorOpen,
  pincode,
  pincodeDraft,
  onLocationToggle,
  onPincodeDraftChange,
  onPincodeSave,
  serviceCartCount,
  secondaryMenuOpen,
  onSecondaryMenuToggle,
  onSecondaryMenuClose,
  isBookingPage,
  onBookingAnchorClick,
  authUser,
  isAuthResolved,
  onClose,
}: MobileMenuProps) {
  const aboutLinks = [...footerInfoLinks, ...footerPolicyLinks];

  return (
    <div
      id="mobile-navigation"
      ref={mobileNavigationRef}
      className="mx-2 rounded-[1.6rem] border border-[#e6cbb3]/70 bg-[linear-gradient(165deg,rgba(255,246,234,0.96),rgba(255,253,249,0.94)_54%,rgba(255,238,219,0.92))] shadow-[0_18px_38px_rgba(128,80,45,0.2)] backdrop-blur-md lg:hidden"
    >
      <div className={`${theme.layout.container} grid max-h-[calc(100svh-5.5rem)] gap-3.5 overflow-y-auto py-5 text-sm font-medium`}>
        {/* Mobile search */}
        <form
          onSubmit={(event) => {
            onSearchSubmit(event);
            onClose();
          }}
          className="group flex h-11 min-w-0 items-center rounded-full border border-[#dcb894]/70 bg-white/86 px-3.5 shadow-[0_10px_20px_rgba(145,92,54,0.12)]"
        >
          <Search className="h-4 w-4 text-[#9f7652]" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search premium services"
            className="ml-2 w-full bg-transparent text-[13px] font-medium text-ink placeholder:text-[#ae8b6c] focus:outline-none"
            aria-label="Search for pet services"
          />
          <button type="submit" className="inline-flex h-7 items-center justify-center rounded-lg bg-[#cf7a43] px-3 text-[11px] font-semibold text-white transition hover:bg-[#be6a35]">
            Go
          </button>
        </form>

        {/* Quick action row */}
        <div className="sticky top-0 z-20 -mx-1 grid gap-2 bg-[linear-gradient(180deg,rgba(255,247,236,0.98),rgba(255,247,236,0.84)_78%,rgba(255,247,236,0))] px-1 pb-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onLocationToggle}
              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-white/88 text-ink transition hover:bg-white"
              aria-expanded={locationEditorOpen}
              aria-controls="mobile-location-editor"
              aria-label={`Edit location pincode. Current pincode ${pincode}`}
            >
              <MapPin className="h-4 w-4 text-coral" aria-hidden="true" />
            </button>

            <Link
              href="/forms/customer-booking#start-your-booking"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/88 px-4 text-[13px] font-semibold text-ink transition hover:bg-white"
              aria-label="View selected services"
              onClick={onClose}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              Services
              {serviceCartCount > 0 ? <span className="rounded-full bg-[#1f1a17] px-1.5 py-0.5 text-[10px] text-white">{serviceCartCount > 9 ? '9+' : serviceCartCount}</span> : null}
            </Link>
          </div>

          {locationEditorOpen ? (
            <LocationEditor
              variant="mobile"
              pincode={pincode}
              pincodeDraft={pincodeDraft}
              onPincodeDraftChange={onPincodeDraftChange}
              onSave={onPincodeSave}
            />
          ) : null}

          {!isBookingPage ? (
            <Link
              href="/forms/customer-booking#start-your-booking"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#d6884f,#bf6c37)] px-5 text-[13px] font-semibold text-white shadow-[0_12px_24px_rgba(190,106,53,0.32)] transition hover:bg-[linear-gradient(135deg,#ca7b42,#b05f2c)]"
              aria-label="Go to customer booking page"
              onClick={(event) => {
                onClose();
                onBookingAnchorClick(event);
              }}
            >
              Book now
            </Link>
          ) : null}
        </div>

        {/* Secondary nav links */}
        <div className="rounded-2xl bg-white/55 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_18px_rgba(143,93,57,0.11)]">
          <div className="grid gap-1.5">
            {/* About Us accordion */}
            <button
              type="button"
              onClick={() => onSecondaryMenuToggle('about')}
              className="inline-flex h-10 items-center justify-between rounded-xl bg-white/78 px-3 text-[13px] font-semibold text-ink transition hover:bg-white"
              aria-expanded={secondaryMenuOpen === 'about'}
              aria-controls="mobile-secondary-about-menu"
            >
              About Us
              <ChevronDown
                className={`h-4 w-4 text-[#9f7652] transition-transform duration-300 ${secondaryMenuOpen === 'about' ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {secondaryMenuOpen === 'about' ? (
              <div id="mobile-secondary-about-menu" className="grid gap-1 pb-1 animate-[accordion-reveal_240ms_cubic-bezier(0.2,0.8,0.2,1)_1]">
                {aboutLinks.map((item, index) => (
                  <Link
                    key={`mobile-${item.href}`}
                    href={item.href}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink/85 transition hover:bg-white/70 hover:text-coral animate-[dropdown-item-enter_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                    style={{ animationDelay: `${index * 24}ms` }}
                    onClick={() => {
                      onSecondaryMenuClose();
                      onClose();
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Services accordion */}
            <button
              type="button"
              onClick={() => onSecondaryMenuToggle('services')}
              className="inline-flex h-10 items-center justify-between rounded-xl bg-white/78 px-3 text-[13px] font-semibold text-ink transition hover:bg-white"
              aria-expanded={secondaryMenuOpen === 'services'}
              aria-controls="mobile-secondary-services-menu"
            >
              Services
              <ChevronDown
                className={`h-4 w-4 text-[#9f7652] transition-transform duration-300 ${secondaryMenuOpen === 'services' ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {secondaryMenuOpen === 'services' ? (
              <div id="mobile-secondary-services-menu" className="grid gap-1 pb-1 animate-[accordion-reveal_240ms_cubic-bezier(0.2,0.8,0.2,1)_1]">
                {navServiceItems.map((item, index) => (
                  <Link
                    key={`mobile-${item.title}`}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink/85 transition hover:bg-white/70 hover:text-coral animate-[dropdown-item-enter_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                    style={{ animationDelay: `${index * 24}ms` }}
                    onClick={() => {
                      onSecondaryMenuClose();
                      onClose();
                    }}
                  >
                    {item.title}
                    {item.badge === 'Active' && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Live</span>
                    )}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Join us */}
            <Link
              href={links.provider}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#d6884f,#bf6c37)] px-3 text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(190,106,53,0.3)] transition hover:bg-[linear-gradient(135deg,#ca7b42,#b05f2c)]"
              onClick={() => {
                onSecondaryMenuClose();
                onClose();
              }}
            >
              Join us as a service provider
            </Link>
          </div>
        </div>

        {/* Sign in link (unauthenticated) */}
        {!authUser && isAuthResolved ? (
          <Link
            href="/auth/sign-in"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-white/76 px-5 text-[13px] font-semibold text-[#2d221a] transition hover:bg-white"
            aria-label="Log in or create an account"
            onClick={onClose}
          >
            Log in / Sign up
          </Link>
        ) : null}
      </div>
    </div>
  );
}
