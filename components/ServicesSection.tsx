import Image from 'next/image';
import FadeInSection from './FadeInSection';
import { services } from '@/lib/site-data';
import { theme } from '@/lib/theme';

const serviceBackgrounds: Record<string, string> = {
  Grooming: '/Birthday/grooming_service.png',
  'Vet Visits': '/Birthday/vet%20visit_service.png',
  'Pet Sitting': '/Birthday/pet%20sitting_service.png',
  Training: '/Birthday/training_service.png',
};

export default function ServicesSection() {
  return (
    <section id="services" className={`${theme.layout.sectionSpacing} scroll-mt-24 bg-[#fdf8f4]`}>
      <div className={theme.layout.container}>
        <FadeInSection>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-ink md:text-4xl">Services for Every Stage of Pet Care</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-ink/80">
            Discover top-rated care providers across grooming, health, companionship, and behavior support.
          </p>
        </FadeInSection>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <FadeInSection key={service.title} delay={index * 0.1}>
                <article className="group relative h-full overflow-hidden rounded-3xl border border-[#f0e4d7] bg-[#fffaf6] p-6 shadow-soft transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-coral/30 hover:shadow-[0_22px_40px_rgba(0,0,0,0.12)]">
                  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_16%,rgba(227,154,93,0.18),transparent_42%),radial-gradient(circle_at_16%_88%,rgba(227,154,93,0.16),transparent_48%)]" />
                    <Image
                      src={serviceBackgrounds[service.title] ?? '/Birthday/grooming_service.png'}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="absolute inset-0 h-full w-full scale-[1.1] object-cover object-center opacity-[0.4] mix-blend-multiply saturate-[0.82] contrast-[0.92] brightness-[1.04] transition-all duration-300 group-hover:scale-[1.14] group-hover:opacity-[0.46]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.4)_54%,rgba(255,255,255,0.56)_100%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(253,248,244,0.26)_0%,rgba(246,239,233,0.12)_45%,rgba(253,248,244,0.3)_100%)]" />
                  </div>

                  <span className="relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/12 text-coral transition-all duration-300 group-hover:scale-110 group-hover:bg-coral group-hover:text-white">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="relative z-10 mt-4 text-xl font-semibold text-ink">{service.title}</h3>
                  <p className="relative z-10 mt-2 text-sm leading-6 text-ink/90">{service.description}</p>
                </article>
              </FadeInSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
