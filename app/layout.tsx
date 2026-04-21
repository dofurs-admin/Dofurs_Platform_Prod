import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';
import AppProviders from '@/components/ui/AppProviders';
import MobileBottomNav from '@/components/MobileBottomNav';
import LoadingScreen from '@/components/ui/LoadingScreen';

export const metadata: Metadata = {
  metadataBase: new URL('https://dofurs.in'),
  title: {
    default: 'Dofurs | Premium Pet Services in Bangalore — Grooming, Vet, Boarding',
    template: '%s | Dofurs',
  },
  description:
    'Book trusted pet grooming, vet home visits, boarding, sitting, training, and birthday services in Bangalore. Verified professionals, transparent pricing, and doorstep convenience with Dofurs.',
  applicationName: 'Dofurs',
  keywords: [
    'pet services Bangalore',
    'pet grooming Bangalore',
    'vet home visit Bangalore',
    'pet boarding Bangalore',
    'pet sitting Bangalore',
    'dog training Bangalore',
    'pet birthday Bangalore',
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
    'geo.region': 'IN-KA',
    'geo.placename': 'Bangalore',
    'geo.position': '12.9716;77.5946',
    ICBM: '12.9716, 77.5946',
  },
  openGraph: {
    title: 'Dofurs | Premium Pet Services in Bangalore',
    description:
      'Verified pet grooming, vet home visits, boarding, sitting, training and birthday services across Bangalore. Transparent pricing. Doorstep convenience.',
    type: 'website',
    locale: 'en_IN',
    url: 'https://dofurs.in',
    siteName: 'Dofurs',
    images: [
      {
        url: '/logo/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'Dofurs — Premium Pet Services in Bangalore',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dofurs | Premium Pet Services in Bangalore',
    description:
      'Verified pet grooming, vet home visits, boarding, sitting, training and birthday services across Bangalore.',
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
const gaId = process.env.NEXT_PUBLIC_GA_ID;
const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://dofurs.in/#organization',
  name: 'Dofurs',
  legalName: 'Dofurs',
  url: 'https://dofurs.in',
  logo: {
    '@type': 'ImageObject',
    url: 'https://dofurs.in/logo/brand-logo.png',
    width: 512,
    height: 512,
  },
  image: 'https://dofurs.in/logo/og-default.jpg',
  description:
    'Dofurs is a premium pet services marketplace connecting pet parents in Bangalore with verified grooming, veterinary, boarding, sitting, training and birthday professionals.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bangalore',
    addressRegion: 'Karnataka',
    addressCountry: 'IN',
  },
  areaServed: {
    '@type': 'City',
    name: 'Bangalore',
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
  description: 'Premium pet services in Bangalore',
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
  alternateName: 'Dofurs Pet Services',
  url: 'https://dofurs.in',
  image: 'https://dofurs.in/logo/og-default.jpg',
  logo: 'https://dofurs.in/logo/brand-logo.png',
  telephone: '+91-70083-65175',
  email: 'petcare@dofurs.in',
  priceRange: '₹₹',
  description:
    'Dofurs provides verified pet grooming, veterinary home visits, boarding, sitting, training, and birthday celebrations across Bangalore with transparent pricing and doorstep convenience.',
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
    { '@type': 'City', name: 'Bengaluru' },
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
    name: 'Pet Services',
    itemListElement: [
      {
        '@type': 'OfferCatalog',
        name: 'Grooming',
        itemListElement: [
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Doorstep Pet Grooming' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Salon Grooming' } },
        ],
      },
      {
        '@type': 'OfferCatalog',
        name: 'Veterinary',
        itemListElement: [
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Vet Home Visit' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Vet Teleconsult' } },
        ],
      },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pet Boarding' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pet Sitting' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Dog Training' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pet Birthday Celebrations' } },
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
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        {clarityId && (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${clarityId}");
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
        <LoadingScreen />
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
