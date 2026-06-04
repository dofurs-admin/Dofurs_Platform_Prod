import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import AppProviders from '@/components/ui/AppProviders';
import MobileBottomNav from '@/components/MobileBottomNav';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';
import { GOOGLE_ADS_ID } from '@/lib/analytics/google-ads';
import { META_PIXEL_ID } from '@/lib/analytics/meta-ads';

export const metadata: Metadata = {
  metadataBase: new URL('https://dofurs.in'),
  title: {
    default: 'Dofurs | Doorstep Pet Grooming in Bengaluru',
    template: '%s | Dofurs',
  },
  description:
    'Book verified doorstep pet grooming in Bengaluru. Dofurs offers transparent grooming packages, pet-safe products, calm handling, and WhatsApp support.',
  applicationName: 'Dofurs',
  keywords: [
    'pet grooming Bengaluru',
    'dog grooming at home Bengaluru',
    'cat grooming Bengaluru',
    'doorstep pet grooming Bengaluru',
    'pet groomer near me Bengaluru',
    'dog bath at home Bengaluru',
    'pet grooming Bangalore',
    'dog grooming at home Bangalore',
    'doorstep pet grooming Bangalore',
    'Dofurs grooming',
    'Dofurs',
  ],
  authors: [{ name: 'Dofurs', url: 'https://dofurs.in' }],
  creator: 'Dofurs',
  publisher: 'Dofurs',
  category: 'Pet Care',
  alternates: {
    canonical: '/',
    languages: {
      'en-IN': '/',
      'en': '/',
    },
  },
  icons: {
    icon: '/logo/fav0d.png',
    shortcut: '/logo/fav0d.png',
    apple: '/logo/fav0d.png',
  },
  other: {
    'facebook-domain-verification': 'dc3sj9szai8a9iq6b4fqhg629h4ev1',
    'geo.region': 'IN-KA',
    'geo.placename': 'Bengaluru',
    'geo.position': '12.9716;77.5946',
    ICBM: '12.9716, 77.5946',
  },
  openGraph: {
    title: 'Dofurs | Doorstep Pet Grooming in Bengaluru',
    description:
      'Verified doorstep pet grooming across Bengaluru with transparent packages from ₹699, pet-safe products, and calm handling.',
    type: 'website',
    locale: 'en_IN',
    url: 'https://dofurs.in',
    siteName: 'Dofurs',
    images: [
      {
        url: '/logo/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'Dofurs doorstep pet grooming in Bengaluru',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dofurs | Doorstep Pet Grooming in Bengaluru',
    description:
      'Book verified doorstep grooming for dogs and cats across Bengaluru, with transparent package pricing and pet-safe products.',
    images: ['/logo/og-default.jpg'],
    creator: '@dofurs',
    site: '@dofurs',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const isDevelopment = process.env.NODE_ENV === 'development';
const googleAdsId = GOOGLE_ADS_ID;
const googleTagManagerId = 'GTM-NHNVFFVX';
const googleTagIds = Array.from(
  new Set([googleAdsId, process.env.NEXT_PUBLIC_GA_ID].filter((id): id is string => Boolean(id))),
);
const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
const metaPixelId = META_PIXEL_ID.trim();

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://dofurs.in/#organization',
  name: 'Dofurs',
  legalName: 'Dofurs',
  alternateName: ['Dofurs Pet Grooming', 'Dofurs Pet Grooming Bangalore'],
  url: 'https://dofurs.in',
  logo: {
    '@type': 'ImageObject',
    url: 'https://dofurs.in/logo/brand-logo.png',
    width: 512,
    height: 512,
  },
  image: 'https://dofurs.in/logo/og-default.jpg',
  description:
    'Dofurs provides doorstep pet grooming in Bengaluru through verified groomers, transparent packages, pet-safe products and hygiene-first handling.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bengaluru',
    addressRegion: 'Karnataka',
    addressCountry: 'IN',
  },
  areaServed: {
    '@type': 'City',
    name: 'Bengaluru',
    alternateName: 'Bangalore',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      telephone: '+91-70083-65175',
      contactType: 'customer support',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi', 'Kannada'],
    },
  ],
  sameAs: [
    'https://www.instagram.com/dofurs',
    'https://www.facebook.com/dofurs',
    'https://www.linkedin.com/company/dofurs',
  ],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://dofurs.in/#website',
  url: 'https://dofurs.in',
  name: 'Dofurs',
  description: 'Doorstep pet grooming in Bengaluru',
  publisher: { '@id': 'https://dofurs.in/#organization' },
  inLanguage: 'en-IN',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://dofurs.in/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://dofurs.in/#localbusiness',
  name: 'Dofurs',
  alternateName: ['Dofurs Pet Grooming', 'Dofurs Pet Grooming Bangalore'],
  url: 'https://dofurs.in',
  image: 'https://dofurs.in/logo/og-default.jpg',
  logo: 'https://dofurs.in/logo/brand-logo.png',
  telephone: '+91-70083-65175',
  email: 'petcare@dofurs.in',
  priceRange: '₹₹',
  description:
    'Dofurs provides verified doorstep pet grooming across Bengaluru with transparent package pricing, pet-safe products, calm handling and WhatsApp support.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bengaluru',
    addressRegion: 'Karnataka',
    addressCountry: 'IN',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  areaServed: [
    { '@type': 'City', name: 'Bengaluru', alternateName: 'Bangalore' },
    { '@type': 'AdministrativeArea', name: 'Karnataka' },
  ],
  serviceArea: {
    '@type': 'GeoCircle',
    geoMidpoint: {
      '@type': 'GeoCoordinates',
      latitude: 12.9716,
      longitude: 77.5946,
    },
    geoRadius: '30000',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '08:00',
      closes: '21:00',
    },
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Pet Grooming Packages',
    itemListElement: [
      {
        '@type': 'OfferCatalog',
        name: 'Doorstep Pet Grooming',
        itemListElement: [
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Monthly Care' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Fur Bath Care' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Fur Makeover' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Essential Grooming' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Complete Care' } },
        ],
      },
    ],
  },
  sameAs: [
    'https://www.instagram.com/dofurs',
    'https://www.facebook.com/dofurs',
    'https://www.linkedin.com/company/dofurs',
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <Script id="google-tag-manager" strategy="lazyOnload">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${googleTagManagerId}');
          `}
        </Script>
        {googleTagIds.length > 0 ? (
          <Script id="google-tag" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${googleTagIds.map((id) => `gtag('config', ${JSON.stringify(id)});`).join('\n              ')}
            `}
          </Script>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        {clarityId && (
          <Script id="microsoft-clarity" strategy="lazyOnload">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${clarityId}");
            `}
          </Script>
        )}
        {metaPixelId && (
          <Script id="meta-pixel" strategy="lazyOnload">
            {`
              !function(f,b,e,v,n,t,s){
                if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)
              }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', ${JSON.stringify(metaPixelId)});
              fbq('track', 'PageView');
            `}
          </Script>
        )}
        {isDevelopment ? (
          <Script id="chunk-load-recovery" strategy="afterInteractive">
            {`
              (function() {
                var reloadKey = 'dofurs_chunk_reload_guard';
                var guardWindowMs = 30000;

                function isChunkLoadMessage(message) {
                  if (!message) {
                    return false;
                  }

                  var normalized = String(message).toLowerCase();
                  return (
                    normalized.indexOf('chunkloaderror') !== -1 ||
                    normalized.indexOf('loading chunk') !== -1 ||
                    normalized.indexOf('failed to fetch dynamically imported module') !== -1
                  );
                }

                function shouldReloadOnce() {
                  try {
                    var previous = Number(sessionStorage.getItem(reloadKey) || '0');
                    var now = Date.now();

                    if (previous && now - previous < guardWindowMs) {
                      return false;
                    }

                    sessionStorage.setItem(reloadKey, String(now));
                    return true;
                  } catch (_error) {
                    return true;
                  }
                }

                function attemptRecovery(message) {
                  if (!isChunkLoadMessage(message)) {
                    return;
                  }

                  if (!shouldReloadOnce()) {
                    return;
                  }

                  window.location.reload();
                }

                window.addEventListener('error', function(event) {
                  var nestedMessage = event && event.error && event.error.message;
                  attemptRecovery((event && event.message) || nestedMessage || '');
                });

                window.addEventListener('unhandledrejection', function(event) {
                  var reason = event && event.reason;
                  var reasonMessage =
                    (reason && reason.message) ||
                    (typeof reason === 'string' ? reason : '');

                  attemptRecovery(reasonMessage);
                });
              })();
            `}
          </Script>
        ) : null}
      </head>
      <body suppressHydrationWarning className="dofurs-mobile-app-theme">
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[9999] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-orange-700 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          Skip to content
        </a>
        <AppProviders>
          <main id="main-content">
            {children}
          </main>
          <MobileBottomNav />
          <WhatsAppFloatingButton />
        </AppProviders>
      </body>
    </html>
  );
}
