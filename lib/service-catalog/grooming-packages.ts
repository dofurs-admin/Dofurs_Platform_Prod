export type GroomingPackage = {
  title: string;
  price: string | number;
  mrp?: number;
  features: string[];
  badge?: string;
  badgeVariant?: 'popular' | 'best-value' | 'premium' | 'deal' | 'special' | 'coming-soon';
  highlighted?: boolean;
  isBookable?: boolean;
  serviceTypeKeywords: string[];
};

export const GROOMING_PACKAGES: GroomingPackage[] = [
  {
    title: 'Monthly Care',
    price: 699,
    mrp: 899,
    features: [
      'Nail Clipping',
      'Nail Grinding',
      'Knot Removal',
      'Eye & Ear Cleaning',
      'Paw Hair Trimming & Cleaning',
      'De-shedding',
    ],
    badge: 'Popular',
    badgeVariant: 'popular',
    serviceTypeKeywords: ['monthly care', 'monthly hygiene', 'doorstep pet grooming', 'basic package'],
  },
  {
    title: 'Fur Bath Care',
    price: 999,
    mrp: 1399,
    features: [
      'Anti-Tick Medicated Bath',
      'Drying',
      'Brushing',
      'De-shedding',
      'De-matting (Knot Removal)',
    ],
    badge: 'Great Deal',
    badgeVariant: 'deal',
    serviceTypeKeywords: ['fur bath care', 'summer pack', 'summer bonanza', 'offer package'],
  },
  {
    title: 'Fur Makeover',
    price: 1199,
    mrp: 1499,
    features: [
      'Hair Cut',
      'Paw Hair Cleaning',
      'Sanitary Area Hair Cleaning',
      'De-matting',
      'Brushing',
      'Ear & Eye Cleaning',
      'De-shedding',
    ],
    badge: 'Great Deal',
    badgeVariant: 'deal',
    serviceTypeKeywords: ['fur makeover', 'fur makeover package'],
  },
  {
    title: 'Essential Grooming',
    price: 1599,
    mrp: 1799,
    features: [
      'Bathing & Drying',
      'Shampoo & Conditioning',
      'Nail Clipping',
      'Paw Hair Cleaning',
      'Sanitary Area Cleaning (Hygiene Trim)',
      'Brushing & De-shedding',
      'De-matting (Knot Removal)',
      'Eye Cleaning / Eye Stain Cleaning',
      'Paw Moisturizing / Paw Massage',
      'Machine Trim (Max 15mm)',
    ],
    badge: 'Best Value',
    badgeVariant: 'best-value',
    highlighted: true,
    serviceTypeKeywords: ['essential grooming'],
  },
  {
    title: 'Complete Care',
    price: 1999,
    mrp: 2299,
    features: [
      'Bathing & Drying',
      'Shampoo & Conditioning',
      'Brushing & De-shedding',
      'De-matting (Knot Removal)',
      'Scissor Haircut (as per your preference)',
      'Face Styling & Eye Area Trimming',
      'Hygiene Trim / Sanitary Area Cleaning',
      'Paw Hair Cleaning',
      'Nail Clipping & Grinding (Smooth Finish)',
      'Paw Moisturizing / Paw Massage',
      'Eye Stain & Ear Cleaning',
      'Nose Cleaning & Moisturizing',
      'Machine Trim (Upto Zero)',
    ],
    badge: 'Premium',
    badgeVariant: 'premium',
    serviceTypeKeywords: ['complete care'],
  },
];

const LEGACY_SERVICE_PRICE_OVERRIDES = [
  { keywords: ['doorstep pet grooming', 'basic package'], price: 899 },
  { keywords: ['summer bonanza'], price: 1199 },
  { keywords: ['fur makeover package'], price: 1199 },
] as const;

function normalizeServiceType(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
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

export function getGroomingPackagePriceByServiceType(serviceType: string): number | null {
  const normalizedServiceType = normalizeSearchText(serviceType);

  const legacyPriceOverride = LEGACY_SERVICE_PRICE_OVERRIDES.find((override) =>
    override.keywords.some((keyword) => normalizedServiceType.includes(normalizeSearchText(keyword))),
  );

  if (legacyPriceOverride) {
    return legacyPriceOverride.price;
  }

  const matchedPackage = getGroomingPackageByServiceType(serviceType);

  if (!matchedPackage) {
    return null;
  }

  if (typeof matchedPackage.price === 'number' && Number.isFinite(matchedPackage.price)) {
    return Math.max(0, Math.round(matchedPackage.price));
  }

  if (typeof matchedPackage.price === 'string') {
    const match = matchedPackage.price.match(/(\d[\d,]*)/);
    if (!match?.[1]) {
      return null;
    }

    const parsed = Number.parseInt(match[1].replace(/,/g, ''), 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}