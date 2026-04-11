import FadeInSection from './FadeInSection';
import { theme } from '@/lib/theme';
import { premiumPrimaryCtaClass } from '@/lib/styles/premium-cta';

export default function HeroSection() {
  const premiumCtaClassName = premiumPrimaryCtaClass('mt-8 h-11 px-8 text-sm font-semibold tracking-[0.01em]');

  return (
    <section id="home" className="relative min-h-screen scroll-mt-24 overflow-hidden pt-24" aria-label="Hero section">
      <video
        className="absolute inset-0 h-full w-full object-cover object-center"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src="/Birthday/dofurs.cover.video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(247,244,239,0.88),rgba(253,232,218,0.58),rgba(31,31,31,0.22))]" aria-hidden="true" />
      <div className={`relative ${theme.layout.container} flex min-h-[calc(100vh-6rem)] items-center`}>
        <FadeInSection className="max-w-2xl rounded-3xl bg-white/66 p-8 shadow-[0_40px_80px_rgba(0,0,0,0.08)] backdrop-blur-md md:p-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Dofurs</p>
          <h1 className="text-4xl font-bold tracking-[-0.02em] text-ink md:text-6xl md:leading-[1.03]">Premium Pet Services, Simplified</h1>
          <p className="mt-5 text-lg text-ink/80 md:text-xl">
            Connecting pet parents with trusted pet care professionals.
          </p>
          <a
            href="#book"
            className={premiumCtaClassName}
            aria-label="Book a Service"
          >
            Book a Service
          </a>
        </FadeInSection>
      </div>
    </section>
  );
}
