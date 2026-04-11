'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, X, UserRound } from 'lucide-react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api/client';
import { getVisibleServiceCartCount } from '@/lib/bookings/service-cart';
import { theme } from '@/lib/theme';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import BrandMark from './BrandMark';
import StorageBackedImage from './ui/StorageBackedImage';
import { DesktopToolbar } from './layouts/navbar/DesktopToolbar';
import { SecondaryNav } from './layouts/navbar/SecondaryNav';
import { MobileMenu } from './layouts/navbar/MobileMenu';
import { UserMenuDropdown } from './layouts/navbar/UserMenuDropdown';
import type { AppRole, SecondaryMenuKey } from './layouts/navbar/types';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoLoadFailed, setProfilePhotoLoadFailed] = useState(false);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [locationEditorOpen, setLocationEditorOpen] = useState(false);
  const [secondaryMenuOpen, setSecondaryMenuOpen] = useState<SecondaryMenuKey | null>(null);
  const [secondaryDropdownShift, setSecondaryDropdownShift] = useState<Record<SecondaryMenuKey, number>>({
    about: 0,
    services: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [pincode, setPincode] = useState('560100');
  const [pincodeDraft, setPincodeDraft] = useState('560100');
  const [serviceCartCount, setServiceCartCount] = useState(0);
  const desktopProfileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileProfileMenuRef = useRef<HTMLDivElement | null>(null);
  const locationEditorRef = useRef<HTMLDivElement | null>(null);
  const mobileNavigationRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const secondaryNavRef = useRef<HTMLDivElement | null>(null);
  const aboutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const servicesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const aboutDropdownRef = useRef<HTMLDivElement | null>(null);
  const servicesDropdownRef = useRef<HTMLDivElement | null>(null);

  const pincodeStorageKey = 'dofurs.header.pincode';
  const pincodePromptedKey = 'dofurs.header.pincodePrompted';
  const serviceCartStorageKey = 'dofurs.booking.serviceCart';
  const serviceCartUpdatedEvent = 'dofurs:service-cart-updated';

  const readServiceCartCount = useCallback(() => {
    if (typeof window === 'undefined') {
      return 0;
    }

    return getVisibleServiceCartCount(Boolean(authUser), window.localStorage.getItem(serviceCartStorageKey));
  }, [authUser, serviceCartStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedPincode = window.localStorage.getItem(pincodeStorageKey);
    const hasCustomPincode = savedPincode && /^[1-9]\d{5}$/.test(savedPincode) && savedPincode !== '560100';

    if (savedPincode && /^[1-9]\d{5}$/.test(savedPincode)) {
      setPincode(savedPincode);
      setPincodeDraft(savedPincode);
    } else {
      // Persist default pincode so the booking flow can pick it up on mount.
      window.localStorage.setItem(pincodeStorageKey, '560100');
    }

    // Auto-detect pincode on initial app entry so booking can start with location context.
    // Ask once, then persist pincode and avoid repeating the prompt every page load.
    if (!hasCustomPincode && navigator.geolocation) {
      void (async () => {
        try {
          if (!window.isSecureContext) {
            return;
          }

          const hasPrompted = window.localStorage.getItem(pincodePromptedKey) === '1';
          if (hasPrompted) {
            return;
          }

          window.localStorage.setItem(pincodePromptedKey, '1');

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { latitude: lat, longitude: lng } = position.coords;
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
                  { headers: { 'Accept-Language': 'en' } },
                );
                const data = (await response.json()) as { address?: { postcode?: string } };
                const postcode = data?.address?.postcode?.replace(/\s/g, '');
                if (postcode && /^[1-9]\d{5}$/.test(postcode)) {
                  setPincode(postcode);
                  setPincodeDraft(postcode);
                  window.localStorage.setItem(pincodeStorageKey, postcode);
                  window.dispatchEvent(new CustomEvent('dofurs:pincode-updated', { detail: { pincode: postcode } }));
                }
              } catch {
                // Silent fail — user can set pincode manually
              }
            },
            () => {
              // Permission denied or unavailable — silent fail
            },
            { enableHighAccuracy: false, timeout: 8000 },
          );
        } catch {
          // Silent fail — user can set pincode manually
        }
      })();
    }

    const updateServiceCartCount = () => {
      setServiceCartCount(readServiceCartCount());
    };

    updateServiceCartCount();

    const handleStorage = () => updateServiceCartCount();
    const handleCartUpdate = () => updateServiceCartCount();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(serviceCartUpdatedEvent, handleCartUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(serviceCartUpdatedEvent, handleCartUpdate);
    };
  }, [authUser, readServiceCartCount, serviceCartUpdatedEvent]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (scrolled) {
      setSecondaryMenuOpen(null);
    }
  }, [scrolled]);

  const updateSecondaryDropdownShift = useCallback((menuKey: SecondaryMenuKey) => {
    if (typeof window === 'undefined') {
      return;
    }

    const trigger = menuKey === 'about' ? aboutTriggerRef.current : servicesTriggerRef.current;
    const dropdown = menuKey === 'about' ? aboutDropdownRef.current : servicesDropdownRef.current;

    if (!trigger || !dropdown) {
      return;
    }

    const safePadding = 16;
    const triggerRect = trigger.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const projectedLeft = triggerCenterX - dropdownRect.width / 2;
    const projectedRight = triggerCenterX + dropdownRect.width / 2;
    let shiftX = 0;

    if (projectedLeft < safePadding) {
      shiftX = safePadding - projectedLeft;
    } else if (projectedRight > window.innerWidth - safePadding) {
      shiftX = window.innerWidth - safePadding - projectedRight;
    }

    setSecondaryDropdownShift((previous) => {
      if (previous[menuKey] === shiftX) {
        return previous;
      }

      return {
        ...previous,
        [menuKey]: shiftX,
      };
    });
  }, []);

  useEffect(() => {
    if (!secondaryMenuOpen) {
      return;
    }

    const updatePosition = () => updateSecondaryDropdownShift(secondaryMenuOpen);

    updatePosition();
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [secondaryMenuOpen, updateSecondaryDropdownShift]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    let active = true;

    const isInvalidRefreshTokenError = (message?: string) => {
      if (!message) {
        return false;
      }

      const normalized = message.toLowerCase();
      return normalized.includes('invalid refresh token') || normalized.includes('refresh token not found');
    };

    async function loadCurrentUser() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error && isInvalidRefreshTokenError(error.message)) {
        await supabase.auth.signOut({ scope: 'local' });
      }

      if (!active) {
        return;
      }

      setAuthUser(error ? null : session?.user ?? null);
      setIsAuthResolved(true);
    }

    loadCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setProfilePhotoUrl(null);
        setAppRole(null);
        setIsAuthResolved(true);
        return;
      }

      setAuthUser(session?.user ?? null);
      setIsAuthResolved(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfilePhoto() {
      if (!authUser) {
        setProfilePhotoLoadFailed(false);
        setProfilePhotoUrl(null);
        setAppRole(null);
        return;
      }

      setProfilePhotoLoadFailed(false);

      try {
        const payload = await apiRequest<{
          profile?: {
            photo_url?: string | null;
            roles?: { name?: AppRole | null } | Array<{ name?: AppRole | null }> | null;
          };
        }>('/api/user/profile', {
          method: 'GET',
        });

        if (!active) {
          return;
        }

        const normalizePhoto = (value: string | null | undefined) => {
          if (typeof value !== 'string') {
            return null;
          }

          const trimmed = value.trim();
          return trimmed.length > 0 ? trimmed : null;
        };

        const photoPath = normalizePhoto(payload?.profile?.photo_url);
        const roleRecord = Array.isArray(payload?.profile?.roles) ? payload?.profile?.roles[0] : payload?.profile?.roles;
        setAppRole(roleRecord?.name ?? null);

        if (photoPath) {
          setProfilePhotoLoadFailed(false);
          setProfilePhotoUrl(photoPath);
          return;
        }

        // Provider accounts may only have photo in providers.profile_photo_url.
        try {
          const providerPayload = await apiRequest<{ dashboard?: { provider?: { profile_photo_url?: string | null } } }>(
            '/api/provider/dashboard',
            {
              method: 'GET',
            },
          );

          if (!active) {
            return;
          }

          const providerPhoto = normalizePhoto(providerPayload?.dashboard?.provider?.profile_photo_url);
          setProfilePhotoLoadFailed(false);
          setProfilePhotoUrl(providerPhoto);
        } catch (err) { console.error(err);
          if (!active) {
            return;
          }

          setProfilePhotoLoadFailed(false);
          setProfilePhotoUrl(null);
        }
      } catch (err) { console.error(err);
        if (!active) {
          return;
        }

        setProfilePhotoLoadFailed(false);
        setProfilePhotoUrl(null);
        setAppRole(null);
      }
    }

    loadProfilePhoto();

    return () => {
      active = false;
    };
  }, [authUser]);

  useEffect(() => {
    setProfilePhotoLoadFailed(false);
  }, [profilePhotoUrl]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      const isDesktopProfileClick = desktopProfileMenuRef.current?.contains(target) ?? false;
      const isMobileProfileClick = mobileProfileMenuRef.current?.contains(target) ?? false;

      if (!isDesktopProfileClick && !isMobileProfileClick) {
        setProfileMenuOpen(false);
      }

      if (locationEditorRef.current && !locationEditorRef.current.contains(target)) {
        const isMobileLocationClick = mobileNavigationRef.current?.contains(target) ?? false;
        if (!isMobileLocationClick) {
          setLocationEditorOpen(false);
        }
      }

      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }

      const isDesktopSecondaryClick = secondaryNavRef.current?.contains(target) ?? false;
      const isMobileSecondaryClick = mobileNavigationRef.current?.contains(target) ?? false;

      if (!isDesktopSecondaryClick && !isMobileSecondaryClick) {
        setSecondaryMenuOpen(null);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMenuOpen(false);
    setProfileMenuOpen(false);
    setAuthUser(null);
    router.replace('/auth/sign-in?mode=signin');
    router.refresh();
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    const destination =
      trimmed.length === 0
        ? '/search'
        : `/search?${new URLSearchParams({ q: trimmed }).toString()}`;

    setMenuOpen(false);
    setSecondaryMenuOpen(null);
    setProfileMenuOpen(false);
    setLocationEditorOpen(false);
    setSearchOpen(false);

    router.push(destination);

    if (typeof window !== 'undefined') {
      const timeoutId = window.setTimeout(() => {
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (current !== destination) {
          window.location.assign(destination);
        }
      }, 450);

      window.setTimeout(() => {
        window.clearTimeout(timeoutId);
      }, 1600);
    }

    setSearchQuery(trimmed);
  }

  function handlePincodeSave() {
    if (!/^[1-9]\d{5}$/.test(pincodeDraft.trim())) {
      return;
    }

    const value = pincodeDraft.trim();
    setPincode(value);
    setLocationEditorOpen(false);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(pincodeStorageKey, value);
      window.dispatchEvent(new CustomEvent('dofurs:pincode-updated', { detail: { pincode: value } }));
    }
  }

  function handleBookingAnchorClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.location.pathname !== '/forms/customer-booking') {
      return;
    }

    event.preventDefault();
    const target = document.getElementById('start-your-booking');

    if (!target) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const targetTop = target.getBoundingClientRect().top + window.scrollY - 96;
    window.history.replaceState(null, '', '/forms/customer-booking#start-your-booking');
    window.scrollTo({ top: Math.max(targetTop, 0), behavior: 'auto' });
  }

  const initialsSource = (authUser?.user_metadata?.name as string | undefined)?.trim() || authUser?.email || 'U';
  const initials = initialsSource.slice(0, 1).toUpperCase();
  const displayName = (authUser?.user_metadata?.name as string | undefined)?.trim() || authUser?.email || 'User';
  const metadataRole =
    (authUser?.user_metadata?.role as AppRole | undefined) ?? (authUser?.app_metadata?.role as AppRole | undefined) ?? null;
  const effectiveRole = appRole ?? metadataRole;
  const profileHref = effectiveRole === 'provider' ? '/dashboard/provider?view=profile' : '/dashboard/user/profile';
  const settingsHref =
    effectiveRole === 'provider'
      ? '/dashboard/provider?view=operations'
      : effectiveRole === 'admin' || effectiveRole === 'staff'
        ? '/dashboard/admin?view=access'
        : '/dashboard/user/settings';
  const petProfilesHref =
    effectiveRole === 'provider'
      ? '/dashboard/provider?view=profile'
      : effectiveRole === 'admin' || effectiveRole === 'staff'
        ? '/dashboard/admin?view=users'
        : '/dashboard/user/pets';
  const petProfilesLabel =
    effectiveRole === 'provider'
      ? 'Profile Studio'
      : effectiveRole === 'admin' || effectiveRole === 'staff'
        ? 'User Directory'
        : 'Pet Profiles';
  const isCustomerAccount = effectiveRole === 'user' || effectiveRole === null;
  const billingHref = '/dashboard/user/billing';
  const subscriptionsHref = '/dashboard/user/subscriptions';
  const addressesHref = '/dashboard/user/addresses';
  const isBookingPage = pathname.startsWith('/forms/customer-booking');

  const sharedUserMenuProps = {
    displayName,
    profileHref,
    settingsHref,
    petProfilesHref,
    petProfilesLabel,
    billingHref,
    subscriptionsHref,
    addressesHref,
    isCustomerAccount,
    effectiveRole,
    onSignOut: handleSignOut,
  };

  return (
    <>
    {/* Mobile menu backdrop — rendered outside <header> so z-index is not confined to the nav stacking context */}
    {menuOpen ? (
      <div
        className="fixed inset-0 z-[39] bg-black/40 backdrop-blur-[2px] lg:hidden"
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />
    ) : null}
    <header
      className={`dofurs-nav-shell fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'border-b border-[#d9b792] bg-[linear-gradient(135deg,rgba(253,236,216,0.95),rgba(250,241,232,0.94),rgba(247,222,194,0.92))] shadow-soft backdrop-blur-md'
          : 'border-b border-transparent bg-transparent shadow-none backdrop-blur-0'
      }`}
    >
      <div className={`${theme.layout.container} flex h-16 items-center justify-between gap-3`}>
        {/* Mobile hamburger */}
        <div className="flex items-center lg:hidden">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e2c2a3] bg-[#fff8ef] text-ink transition hover:bg-[#fff2e6]"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => {
              setMenuOpen((open) => !open);
              setProfileMenuOpen(false);
            }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Brand */}
        <Link href="/" aria-label="Go to homepage" className="inline-flex h-11 items-center self-center">
          <BrandMark compact />
        </Link>

        {/* Mobile profile avatar / sign-in */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center lg:hidden" ref={mobileProfileMenuRef}>
            {isAuthResolved && authUser ? (
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((open) => !open);
                  setMenuOpen(false);
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e2c2a3] bg-[#fff8ef] text-sm font-bold text-ink transition hover:bg-[#fff2e6]"
                aria-label="Open user profile menu"
                aria-expanded={profileMenuOpen}
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
                      onError={() => setProfilePhotoLoadFailed(true)}
                    />
                  </span>
                ) : (
                  initials
                )}
              </button>
            ) : isAuthResolved ? (
              <Link
                href="/auth/sign-in"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e2c2a3] bg-[#fff8ef] text-ink transition hover:bg-[#fff2e6]"
                aria-label="Log in"
              >
                <UserRound className="h-4 w-4" />
              </Link>
            ) : null}

            {isAuthResolved && authUser && profileMenuOpen ? (
              <UserMenuDropdown
                variant="mobile"
                {...sharedUserMenuProps}
                onClose={() => setProfileMenuOpen(false)}
              />
            ) : null}
          </div>
        </div>

        {/* Desktop toolbar */}
        <DesktopToolbar
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          searchRef={searchRef}
          onSearchOpen={() => setSearchOpen(true)}
          onSearchQueryChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          locationEditorOpen={locationEditorOpen}
          locationEditorRef={locationEditorRef}
          pincode={pincode}
          pincodeDraft={pincodeDraft}
          onLocationToggle={() => setLocationEditorOpen((open) => !open)}
          onPincodeDraftChange={setPincodeDraft}
          onPincodeSave={handlePincodeSave}
          serviceCartCount={serviceCartCount}
          isAuthResolved={isAuthResolved}
          authUser={authUser}
          profilePhotoUrl={profilePhotoUrl}
          profilePhotoLoadFailed={profilePhotoLoadFailed}
          onProfilePhotoError={() => setProfilePhotoLoadFailed(true)}
          profileMenuOpen={profileMenuOpen}
          desktopProfileMenuRef={desktopProfileMenuRef}
          onProfileMenuToggle={() => setProfileMenuOpen((open) => !open)}
          initials={initials}
          {...sharedUserMenuProps}
          isBookingPage={isBookingPage}
          onBookingAnchorClick={handleBookingAnchorClick}
          onProfileMenuClose={() => setProfileMenuOpen(false)}
        />
      </div>

      {/* Desktop secondary nav */}
      <SecondaryNav
        scrolled={scrolled}
        secondaryMenuOpen={secondaryMenuOpen}
        secondaryDropdownShift={secondaryDropdownShift}
        secondaryNavRef={secondaryNavRef}
        aboutTriggerRef={aboutTriggerRef}
        servicesTriggerRef={servicesTriggerRef}
        aboutDropdownRef={aboutDropdownRef}
        servicesDropdownRef={servicesDropdownRef}
        onToggleMenu={(key) => setSecondaryMenuOpen((value) => (value === key ? null : key))}
        onCloseMenu={() => setSecondaryMenuOpen(null)}
      />

      {/* Mobile menu */}
      {menuOpen ? (
        <MobileMenu
          mobileNavigationRef={mobileNavigationRef}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          locationEditorOpen={locationEditorOpen}
          pincode={pincode}
          pincodeDraft={pincodeDraft}
          onLocationToggle={() => setLocationEditorOpen((open) => !open)}
          onPincodeDraftChange={setPincodeDraft}
          onPincodeSave={handlePincodeSave}
          serviceCartCount={serviceCartCount}
          secondaryMenuOpen={secondaryMenuOpen}
          onSecondaryMenuToggle={(key) => setSecondaryMenuOpen((value) => (value === key ? null : key))}
          onSecondaryMenuClose={() => setSecondaryMenuOpen(null)}
          isBookingPage={isBookingPage}
          onBookingAnchorClick={handleBookingAnchorClick}
          authUser={authUser}
          isAuthResolved={isAuthResolved}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </header>
    </>
  );
}
