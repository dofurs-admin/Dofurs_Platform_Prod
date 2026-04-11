import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';
import AppProviders from '@/components/ui/AppProviders';
import MobileBottomNav from '@/components/MobileBottomNav';
import LoadingScreen from '@/components/ui/LoadingScreen';

export const metadata: Metadata = {
  metadataBase: new URL('https://dofurs.in'),
  title: 'Dofurs | Premium Pet Services, Simplified',
  description: 'Dofurs connects pet owners with verified pet care professionals for seamless bookings and trusted service.',
  keywords: ['pet services', 'pet sitting', 'vet visits', 'pet grooming', 'Dofurs'],
  icons: {
    icon: '/logo/fav0d.png',
    shortcut: '/logo/fav0d.png',
    apple: '/logo/fav0d.png',
  },
  openGraph: {
    title: 'Dofurs | Premium Pet Services, Simplified',
    description: 'Connecting pet parents with trusted pet care professionals.',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/logo/fav0d.png',
        width: 512,
        height: 512,
        alt: 'Dofurs favicon',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Dofurs | Premium Pet Services, Simplified',
    description: 'Connecting pet parents with trusted pet care professionals.',
    images: ['/logo/fav0d.png'],
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
