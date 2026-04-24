export type GroomingPackage = {
  title: string;
  price: string | number;
  features: string[];
  badge?: string;
  badgeVariant?: 'popular' | 'best-value' | 'premium' | 'deal' | 'special' | 'coming-soon';
  highlighted?: boolean;
  isBookable?: boolean;
  serviceTypeKeywords: string[];
};

export const GROOMING_PACKAGES: GroomingPackage[] = [
  {
    title: 'Doorstep Pet Grooming',
    price: 'Starts from 899',
    features: [
      'Nail clipping',
      'Paw Hair Trimming',
      'Knot Removal & De-shedding',
      'Eye & Ear Cleaning',
    ],
    badge: 'Popular',
    badgeVariant: 'popular',
    serviceTypeKeywords: ['doorstep pet grooming', 'basic package'],
  },
  {
    title: 'Summer Bonanza',
    price: 1199,
    features: [
      'Bathing, Drying & Conditioning',
      'Shampoo & Conditioner',
      'Brushing & De-shedding',
      'De-matting',
      'Nail Clipping & Paw Hair Trimming',
    ],
    badge: 'Great Deal',
    badgeVariant: 'deal',
    serviceTypeKeywords: ['summer bonanza', 'offer package'],
  },
  {
    title: 'Essential Grooming',
    price: 1799,
    features: [
      'Bathing, Drying & Conditioning',
      'Nail Clipping',
      'Paw Hair Trimming',
      'Sanitary Area Hair Trimming',
      'Brushing & De-shedding',
      'De-matting',
      'Paw Massage',
      'Eye Cleaning',
    ],
    badge: 'Best Value',
    badgeVariant: 'best-value',
    highlighted: true,
    serviceTypeKeywords: ['essential grooming'],
  },
  {
    title: 'Complete Care',
    price: 2299,
    features: [
      'Bathing, Drying & Conditioning',
      'Nail Clipping & Grinding',
      'Paw Care & Massage',
      'Sanitary Area Hair Trimming',
      'Brushing & De-shedding',
      'De-matting',
      'Custom Haircut',
      'Face Styling',
      'Eye, Ear & Nose Cleaning',
    ],
    badge: 'Premium',
    badgeVariant: 'premium',
    serviceTypeKeywords: ['complete care'],
  },
  {
    title: 'Pet Birthday Package',
    price: 1999,
    features: ['Custom Party Setup', 'Treats & Decorations', 'Photoshoots'],
    badge: 'COMING SOON',
    badgeVariant: 'coming-soon',
    isBookable: false,
    serviceTypeKeywords: ['pet birthday package', 'birthday package', 'birthday'],
  },
  {
    title: 'Pet Boarding',
    price: 999,
    features: ['Safe Stay', 'Comfortable Environment', 'Stress-Free Care'],
    badge: 'COMING SOON',
    badgeVariant: 'coming-soon',
    isBookable: false,
    serviceTypeKeywords: ['pet boarding', 'boarding'],
  },
];

function normalizeServiceType(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getGroomingPackageByServiceType(serviceType: string): GroomingPackage | null {
  const normalizedServiceType = normalizeServiceType(serviceType);

  const matchedPackage = GROOMING_PACKAGES.find((pkg) =>
    pkg.serviceTypeKeywords.some((keyword) => normalizedServiceType.includes(normalizeServiceType(keyword))),
  );

  return matchedPackage ?? null;
}