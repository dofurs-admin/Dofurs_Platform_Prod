'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { type RefObject } from 'react';
import { theme } from '@/lib/theme';
import { footerInfoLinks, footerPolicyLinks, links, services as marketplaceServices } from '@/lib/site-data';
import type { SecondaryMenuKey } from './types';

interface SecondaryNavProps {
  scrolled: boolean;
  secondaryMenuOpen: SecondaryMenuKey | null;
  secondaryDropdownShift: Record<SecondaryMenuKey, number>;
  secondaryNavRef: RefObject<HTMLDivElement | null>;
  aboutTriggerRef: RefObject<HTMLButtonElement | null>;
  servicesTriggerRef: RefObject<HTMLButtonElement | null>;
  aboutDropdownRef: RefObject<HTMLDivElement | null>;
  servicesDropdownRef: RefObject<HTMLDivElement | null>;
  onToggleMenu: (key: SecondaryMenuKey) => void;
  onCloseMenu: () => void;
}

export function SecondaryNav({
  scrolled,
  secondaryMenuOpen,
  secondaryDropdownShift,
  secondaryNavRef,
  aboutTriggerRef,
  servicesTriggerRef,
  aboutDropdownRef,
  servicesDropdownRef,
  onToggleMenu,
  onCloseMenu,
}: SecondaryNavProps) {
  const aboutLinks = [...footerInfoLinks, ...footerPolicyLinks];

  return (
    <div
      className={`hidden transition-all duration-300 ease-out lg:block ${
        scrolled ? 'pointer-events-none max-h-0 -translate-y-2 opacity-0' : 'max-h-20 translate-y-0 opacity-100'
      }`}
    >
      <div className={`${theme.layout.container} relative`} ref={secondaryNavRef}>
        <div className="flex h-10 items-center justify-center gap-7">
          {/* About Us dropdown */}
          <div className="relative">
            <button
              ref={aboutTriggerRef}
              type="button"
              onClick={() => onToggleMenu('about')}
              className="group relative inline-flex h-8 items-center gap-1 px-1 text-[13px] font-semibold tracking-[0.02em] text-[#6f4f37] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:animate-[nav-jump_300ms_cubic-bezier(0.2,0.9,0.25,1.25)_1] hover:text-coral"
              aria-expanded={secondaryMenuOpen === 'about'}
              aria-controls="secondary-about-menu"
            >
              About Us
              <ChevronDown
                className={`h-3.5 w-3.5 text-[#9f7652] transition-transform duration-300 ${secondaryMenuOpen === 'about' ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              <span
                className={`absolute inset-x-0 -bottom-0.5 h-px origin-center bg-[#d58a53] transition-transform duration-300 ${
                  secondaryMenuOpen === 'about' ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
                aria-hidden="true"
              />
            </button>

            {secondaryMenuOpen === 'about' ? (
              <div
                ref={aboutDropdownRef}
                id="secondary-about-menu"
                className="absolute left-1/2 top-[calc(100%+0.45rem)] z-[62] w-[min(470px,88vw)] overflow-hidden rounded-2xl border border-[#e7c9ae] bg-[linear-gradient(145deg,#fff8ef,#fff2e6_55%,#fff9f3)] p-4 shadow-soft-md animate-[dropdown-enter_260ms_cubic-bezier(0.2,0.8,0.2,1)_1]"
                style={{ translate: `calc(-50% + ${secondaryDropdownShift.about}px) 0` }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8f6645]">Explore Dofurs</p>
                <div className="mt-2 grid divide-y divide-[#edd7c3]/75">
                  {aboutLinks.map((item, index) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-2 py-2.5 text-[13px] font-medium text-[#664934] transition-colors duration-200 hover:text-coral animate-[dropdown-item-enter_240ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                      style={{ animationDelay: `${index * 28}ms` }}
                      onClick={onCloseMenu}
                    >
                      <span className="h-1 w-1 rounded-full bg-[#d6a079] transition-colors group-hover:bg-coral" aria-hidden="true" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Services dropdown */}
          <div className="relative">
            <button
              ref={servicesTriggerRef}
              type="button"
              onClick={() => onToggleMenu('services')}
              className="group relative inline-flex h-8 items-center gap-1 px-1 text-[13px] font-semibold tracking-[0.02em] text-[#6f4f37] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:animate-[nav-jump_300ms_cubic-bezier(0.2,0.9,0.25,1.25)_1] hover:text-coral"
              aria-expanded={secondaryMenuOpen === 'services'}
              aria-controls="secondary-services-menu"
            >
              Services
              <ChevronDown
                className={`h-3.5 w-3.5 text-[#9f7652] transition-transform duration-300 ${secondaryMenuOpen === 'services' ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              <span
                className={`absolute inset-x-0 -bottom-0.5 h-px origin-center bg-[#d58a53] transition-transform duration-300 ${
                  secondaryMenuOpen === 'services' ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
                aria-hidden="true"
              />
            </button>

            {secondaryMenuOpen === 'services' ? (
              <div
                ref={servicesDropdownRef}
                id="secondary-services-menu"
                className="absolute left-1/2 top-[calc(100%+0.45rem)] z-[62] w-[min(430px,86vw)] overflow-hidden rounded-2xl border border-[#e7c9ae] bg-[linear-gradient(145deg,#fff8ef,#fff2e6_55%,#fff9f3)] p-4 shadow-soft-md animate-[dropdown-enter_260ms_cubic-bezier(0.2,0.8,0.2,1)_1]"
                style={{ translate: `calc(-50% + ${secondaryDropdownShift.services}px) 0` }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8f6645]">Service Categories</p>
                <div className="mt-2 grid divide-y divide-[#edd7c3]/75">
                  {marketplaceServices.map((item, index) => (
                    <Link
                      key={item.title}
                      href={`/forms/customer-booking?search=${encodeURIComponent(item.title)}#start-your-booking`}
                      className="group flex items-center gap-2 py-2.5 text-[13px] font-medium text-[#664934] transition-colors duration-200 hover:text-coral animate-[dropdown-item-enter_240ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                      style={{ animationDelay: `${index * 28}ms` }}
                      onClick={onCloseMenu}
                    >
                      <span className="h-1 w-1 rounded-full bg-[#d6a079] transition-colors group-hover:bg-coral" aria-hidden="true" />
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Join us link */}
          <Link
            href={links.provider}
            className="group relative inline-flex h-8 items-center px-1 text-[13px] font-semibold tracking-[0.02em] text-[#9f5d2d] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:animate-[nav-jump_300ms_cubic-bezier(0.2,0.9,0.25,1.25)_1] hover:text-[#b56b36]"
            aria-label="Open service provider application form"
          >
            Join us as a service provider
          </Link>
        </div>
      </div>
    </div>
  );
}
