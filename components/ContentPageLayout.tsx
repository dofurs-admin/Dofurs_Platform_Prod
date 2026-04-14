import Navbar from './Navbar';
import Footer from './Footer';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { PawPrint } from 'lucide-react';
import FadeInSection from './FadeInSection';
import FloatingPawBackground from './FloatingPawBackground';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

type ContentPageLayoutProps = {
  title: string;
  description: string;
  heroImageSrc?: string;
  heroImageAlt?: string;
  heroImageFirstOnMobile?: boolean;
  heroImageObjectPosition?: string;
  hideHero?: boolean;
  children: React.ReactNode;
  belowContent?: React.ReactNode;
};

export default function ContentPageLayout({
  title,
  description,
  heroImageSrc = '/Birthday/partners-with-dofurs.png',
  heroImageAlt = 'Dofurs pet care',
  heroImageFirstOnMobile = false,
  heroImageObjectPosition = 'center',
  hideHero = false,
  children,
  belowContent,
}: ContentPageLayoutProps) {
  return (
    <>
      <Navbar />
      <main
        className={`${plusJakarta.className} dofurs-mobile-main relative overflow-hidden bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_36%,#fffcf9_100%)] pt-24 text-ink`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(circle_at_14%_4%,rgba(228,153,90,0.18),transparent_52%),radial-gradient(circle_at_86%_12%,rgba(154,122,87,0.11),transparent_48%),linear-gradient(to_bottom,rgba(255,248,240,0.78),rgba(255,255,255,0))]"
          aria-hidden="true"
        />
        <FloatingPawBackground />
        {!hideHero && <section className="relative z-[2] overflow-hidden py-12 md:py-16 lg:py-20">
          <PawPrint className="absolute left-8 top-10 h-8 w-8 text-[#e3b690]/40" aria-hidden="true" />
          <PawPrint className="absolute right-10 bottom-8 h-7 w-7 -rotate-12 text-[#cfa47f]/30" aria-hidden="true" />
          <div className="absolute left-1/2 top-6 h-24 w-24 -translate-x-1/2 rounded-full bg-[#f2cba8]/35 blur-2xl" aria-hidden="true" />

          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="relative grid items-center gap-10 overflow-hidden rounded-[2rem] border border-[#e2c2a4] bg-[linear-gradient(140deg,#fff4e4_0%,#fffdf9_46%,#ffe9d2_100%)] p-6 shadow-premium-xl md:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:p-10">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.7),rgba(255,255,255,0))]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(228,153,90,0.24),transparent_40%),radial-gradient(circle_at_85%_82%,rgba(154,122,87,0.16),transparent_42%)]" aria-hidden="true" />

              <FadeInSection
                delay={0.05}
                className={heroImageFirstOnMobile ? 'order-2 text-center lg:order-1 lg:text-left' : 'order-1 text-center lg:text-left'}
              >
                <div className="relative z-[2]">
                  <span className="inline-flex items-center rounded-full border border-[#dbb796] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b633f]">
                    Dofurs Premium Experience
                  </span>
                  <h1 className="mt-4 text-[32px] font-bold leading-[1.08] tracking-[-0.02em] text-ink md:text-5xl">{title}</h1>
                  <p className="mt-4 max-w-3xl text-[15.5px] leading-7 text-[#5f5f5f] md:text-lg md:leading-8">{description}</p>
                </div>
              </FadeInSection>

              <div
                className={`${heroImageFirstOnMobile ? 'order-1 lg:order-2' : 'order-2'} relative mx-auto w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[#e8ccb3] bg-white/90 shadow-[0_24px_48px_rgba(123,78,42,0.2)]`}
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={heroImageSrc}
                    alt={heroImageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 35vw"
                    className="object-cover"
                    style={{ objectPosition: heroImageObjectPosition }}
                    priority
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjZjVlNmQ4Ii8+PC9zdmc+"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-[#f6efe9]/64 via-[#f6efe9]/20 to-transparent" aria-hidden="true" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#f6efe9]/26 via-transparent to-transparent" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </section>}

        <section className={`relative z-10 pb-12 md:pb-16 lg:pb-20${hideHero ? ' pt-6 sm:pt-12 md:pt-16' : ''}`}>
          <div className="mx-auto w-full max-w-[1200px] px-1.5 sm:px-4 md:px-6 lg:px-8">
            <div className="rounded-2xl sm:rounded-[1.75rem] border border-[#ecd6c2] bg-[linear-gradient(180deg,_#ffffff_0%,_#fff8f2_38%,_#fbf3eb_100%)] p-2 sm:p-6 shadow-[0_22px_48px_rgba(132,95,61,0.12)] md:p-10 lg:p-12">
              <div className="grid gap-3 sm:gap-6 text-ink/85 md:gap-8 [&_h2:first-of-type]:mt-0 [&_h2]:mt-8 [&_h2]:text-[1.75rem] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_p]:max-w-[76ch] [&_p]:text-[15.5px] [&_p]:leading-7 [&_ul]:max-w-[76ch] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {children}
              </div>
              {belowContent}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
