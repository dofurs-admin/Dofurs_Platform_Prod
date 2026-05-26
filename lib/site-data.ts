import { Bath, CalendarCheck2, PawPrint, Smile } from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
};

type ServiceAvailability = 'active' | 'coming-soon';

export const navItems: NavItem[] = [];

export const headerPageLinks: NavItem[] = [
  { label: 'About', href: '/about' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Blog', href: '/blog' },
];

export const footerInfoLinks = [
  { label: 'About', href: '/about' },
  { label: 'Contact Us', href: '/contact-us' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Refer & Earn', href: '/refer-and-earn' },
  { label: 'Blog', href: '/blog' },
] as const;

export const footerPolicyLinks = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms & Conditions', href: '/terms-conditions' },
  { label: 'Cancellation & Adjustment', href: '/cancellation-adjustment-policy' },
] as const;

// Navigation dropdown items — explicit hrefs to service landing pages
export const navServiceItems = [
  { title: 'Pet Grooming', href: '/pet-grooming/bengaluru', availability: 'active', badge: 'Live' },
] as const;

type ServiceSummary = {
  title: string;
  description: string;
  icon: typeof Bath;
  availability: ServiceAvailability;
};

export const services: ServiceSummary[] = [
  {
    title: 'Pet Grooming',
    description: 'Doorstep grooming packages for baths, haircuts, de-shedding, nail care, ear cleaning, and hygiene trims.',
    icon: Bath,
    availability: 'active',
  },
];

export const steps = [
  {
    title: 'Choose Package',
    description: 'Pick the grooming package that fits your pet\'s coat, comfort level, and hygiene needs.',
    icon: PawPrint,
  },
  {
    title: 'Book Now',
    description: 'Confirm your pet, address, pincode, slot, and package details in one flow.',
    icon: CalendarCheck2,
  },
  {
    title: 'Relax & Enjoy',
    description: 'A verified groomer arrives with tools, pet-safe products, and calm handling.',
    icon: Smile,
  },
] as const;

export const imagery = {
  hero: {
    src: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=2000&q=80',
    alt: 'Happy pet owner hugging a golden dog outdoors.',
  },
  fullWidth: {
    src: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=2000&q=80',
    alt: 'Smiling dog looking toward the camera in warm light.',
  },
};

export const links = {
  booking: '/forms/customer-booking',
  provider: '/forms/provider-application',
};

export const supportContact = {
  whatsappE164: '917008365175',
  whatsappDisplay: '+91 70083 65175',
} as const;

export const whatsappLinks = {
  support:
    `https://wa.me/${supportContact.whatsappE164}?text=Hello%2C%20I%20would%20like%20to%20book%20a%20Dofurs%20grooming%20session%20for%20my%20pet.`,
  subscriptionSupport:
    `https://wa.me/${supportContact.whatsappE164}?text=Hi%2C%20I%20need%20help%20with%20my%20DOFURS%20subscription%20(upgrade%2C%20cancellation%2C%20or%20refund).`,
} as const;

export const formEmbeds = {
  booking:
    'https://docs.google.com/forms/d/e/1FAIpQLScV2Ew_Bdo5ijIL-wYFeQn4Mf_em2U3UCX1QSWRAEh88bYcxA/viewform?embedded=true',
  provider:
    'https://docs.google.com/forms/d/e/1FAIpQLSenGg1wIlXDjsvRtFhStnMYTetVRXcB6zz-cz60Aa7nwSjXUw/viewform?embedded=true',

} as const;

export const reviews = [
  {
    quote: 'Booked grooming in minutes. Clear updates and a calm, happy pup after the session.',
    name: 'Rajesh Patra',
    role: 'Pet Parent',
    service: 'Doorstep Grooming',
  },
  {
    quote: 'The provider was punctual, gentle, and professional. The booking experience felt truly seamless.',
    name: 'Anupam P',
    role: 'Dog Owner',
    service: 'At-Home Grooming',
  },
  {
    quote: 'Fast confirmation, transparent package details, and excellent coat care. Dofurs made grooming easier.',
    name: 'M Saiba',
    role: 'Cat Parent',
    service: 'Cat Grooming',
  },
] as const;
