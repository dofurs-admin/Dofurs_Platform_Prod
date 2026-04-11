import Image from 'next/image';
import FadeInSection from './FadeInSection';
import { steps } from '@/lib/site-data';
import { theme } from '@/lib/theme';

const stepBackgrounds: Record<string, string> = {
  'Choose Service': '/Birthday/chose%20service_card.png',
  'Book Instantly': '/Birthday/book%20instantly_card.png',
  'Relax & Enjoy': '/Birthday/relax%20%26%20enjoy%20_card.png',
};

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className={`${theme.layout.sectionSpacing} scroll-mt-24 bg-[#f8f5f2]`}>
      <div className={theme.layout.container}>
        <FadeInSection>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-ink md:text-4xl">How It Works</h2>
        </FadeInSection>
        <div className="relative mt-12 grid gap-6 md:grid-cols-3">
          <div className="absolute left-[17%] right-[17%] top-12 hidden h-px bg-coral/20 md:block" aria-hidden="true" />
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <FadeInSection key={step.title} delay={index * 0.1} className="h-full">
                <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#f0e4d7] bg-white p-7 shadow-soft transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_22px_40px_rgba(0,0,0,0.12)]">
                  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <Image
                      src={stepBackgrounds[step.title] ?? '/Birthday/chose%20service_card.png'}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-center opacity-[0.38] mix-blend-multiply transition-all duration-300 group-hover:scale-[1.12] group-hover:opacity-[0.44]"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0.48)_56%,rgba(255,255,255,0.62)_100%)]" />
                  </div>

                  <p className="relative z-10 text-base font-bold tracking-wide text-coral">Step {index + 1}</p>
                  <Icon className="relative z-10 mt-4 text-coral transition-transform duration-300 group-hover:scale-110" size={30} aria-hidden="true" />
                  <h3 className="relative z-10 mt-4 text-2xl font-semibold text-ink">{step.title}</h3>
                  <p className="relative z-10 mt-3 flex-1 text-ink/80">{step.description}</p>
                </article>
              </FadeInSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
