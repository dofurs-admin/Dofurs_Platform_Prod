/**
 * JSON-LD schema helpers for structured-data injection across pages.
 * Keep all output keyed to schema.org so Google rich results can pick them up.
 */

const SITE_URL = 'https://dofurs.in';
const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export type BreadcrumbCrumb = {
  name: string;
  url: string;
};

export function buildBreadcrumbSchema(crumbs: BreadcrumbCrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url.startsWith('http') ? crumb.url : `${SITE_URL}${crumb.url}`,
    })),
  };
}

export type ServiceOffer = {
  name: string;
  priceFrom?: number;
  priceCurrency?: string;
  description?: string;
};

export type ServiceSchemaOptions = {
  name: string;
  description: string;
  url: string;
  serviceType: string;
  category?: string;
  image?: string;
  offers?: ServiceOffer[];
};

export function buildServiceSchema(options: ServiceSchemaOptions) {
  const offers = options.offers?.map((offer) => {
    const base: Record<string, unknown> = {
      '@type': 'Offer',
      name: offer.name,
      priceCurrency: offer.priceCurrency ?? 'INR',
      availability: 'https://schema.org/InStock',
    };
    if (offer.priceFrom !== undefined) {
      base.price = offer.priceFrom;
      base.priceSpecification = {
        '@type': 'PriceSpecification',
        price: offer.priceFrom,
        priceCurrency: offer.priceCurrency ?? 'INR',
        valueAddedTaxIncluded: true,
      };
    }
    if (offer.description) base.description = offer.description;
    return base;
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: options.name,
    description: options.description,
    url: options.url,
    serviceType: options.serviceType,
    category: options.category ?? 'Pet Grooming',
    image: options.image ?? `${SITE_URL}/logo/og-default.jpg`,
    provider: { '@id': ORGANIZATION_ID },
    areaServed: {
      '@type': 'City',
      name: 'Bengaluru',
      containedInPlace: {
        '@type': 'State',
        name: 'Karnataka',
        containedInPlace: {
          '@type': 'Country',
          name: 'India',
        },
      },
    },
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: options.url,
      servicePhone: '+91-70083-65175',
      availableLanguage: ['English', 'Hindi', 'Kannada'],
    },
    ...(offers && offers.length > 0 ? { offers } : {}),
  };
}

export type AggregateRatingInput = {
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
};

export type ReviewInput = {
  author: string;
  body: string;
  rating?: number;
  datePublished?: string;
};

export function buildAggregateRatingSchema(input: AggregateRatingInput) {
  return {
    '@type': 'AggregateRating',
    ratingValue: input.ratingValue,
    reviewCount: input.reviewCount,
    bestRating: input.bestRating ?? 5,
    worstRating: input.worstRating ?? 1,
  };
}

export function buildReviewSchema(review: ReviewInput) {
  return {
    '@type': 'Review',
    author: { '@type': 'Person', name: review.author },
    reviewBody: review.body,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating ?? 5,
      bestRating: 5,
      worstRating: 1,
    },
    ...(review.datePublished ? { datePublished: review.datePublished } : {}),
  };
}

export type HowToStepInput = {
  name: string;
  text: string;
  image?: string;
};

export type HowToSchemaOptions = {
  name: string;
  description: string;
  image?: string;
  totalTime?: string; // ISO 8601 duration, e.g. "PT15M"
  steps: HowToStepInput[];
};

export function buildHowToSchema(options: HowToSchemaOptions) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: options.name,
    description: options.description,
    ...(options.image ? { image: options.image } : {}),
    ...(options.totalTime ? { totalTime: options.totalTime } : {}),
    step: options.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image ? { image: step.image } : {}),
    })),
  };
}

export function jsonLdScript(schema: Record<string, unknown> | Array<Record<string, unknown>>) {
  return {
    __html: JSON.stringify(schema),
  };
}
