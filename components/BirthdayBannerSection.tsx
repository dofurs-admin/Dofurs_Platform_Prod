import Image from 'next/image';
import Link from 'next/link';
import FadeInSection from './FadeInSection';
import { links } from '@/lib/site-data';

const birthdayBookingHref = `${links.booking}?serviceType=Birthday#start-your-booking`;

export default function BirthdayBannerSection() {
  return (
    <section aria-labelledby="birthday-experience-heading" className="mt-16">
      <FadeInSection>
        <div className="relative overflow-hidden rounded-3xl border border-[#e2c2a4] bg-[linear-gradient(140deg,#fff4e4_0%,#fffdf9_46%,#ffe9d2_100%)] p-5 shadow-[0_26px_56px_rgba(145,92,54,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_36px_70px_rgba(145,92,54,0.25)] sm:p-7 lg:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.68),rgba(255,255,255,0))]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(228,153,90,0.28),transparent_38%),radial-gradient(circle_at_86%_84%,rgba(154,122,87,0.18),transparent_38%)]"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-[1px] rounded-[calc(1.5rem-1px)] bg-[linear-gradient(165deg,rgba(255,255,255,0.5),rgba(255,250,244,0.2))]" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-14 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(246,195,148,0.3),rgba(246,195,148,0))]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-14 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(234,170,123,0.24),rgba(234,170,123,0))]"
          />

          <div className="relative z-10 grid items-center gap-7 md:grid-cols-2 md:gap-8">
            <div>
              <p className="inline-flex rounded-full border border-[#e7c4a7] bg-[linear-gradient(145deg,#fff8f0,#fff2e2)] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#8c471f] shadow-[0_6px_16px_rgba(145,92,54,0.12)]">
                Birthday Experiences
              </p>
              <h2 id="birthday-experience-heading" className="mt-4 text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-4xl">
                Celebrate Their Day in Style
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-700 sm:text-base">
                Premium setup, pet-safe decor, and easy booking. Give your pet a memorable birthday without the planning stress.
              </p>

              <Link
                href={birthdayBookingHref}
                aria-label="Book Birthday Celebration for your pet"
                className="mt-6 inline-flex items-center rounded-full bg-[linear-gradient(135deg,#de9158,#c7773b)] px-6 py-3 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#d7864f,#bf6f34)] hover:shadow-[0_16px_32px_rgba(199,119,59,0.38)]"
              >
                Book Birthday Celebration
              </Link>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-[#f5ddc6]/25 bg-transparent shadow-[0_14px_30px_rgba(130,89,56,0.12)]">
              <div className="relative aspect-[16/9]">
                <Image
                  src="/Birthday/birthday.pet.dofurs.png"
                  alt="A joyful pet birthday setup with festive decorations and cake"
                  fill
                  sizes="(max-width: 768px) 100vw, 42vw"
                  className="object-cover saturate-[0.92] contrast-[1.02] brightness-[1]"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-[#fff7ee]/20 via-[#fff8f2]/4 to-[#fff3e6]/16" aria-hidden="true" />
                <div
                  className="absolute inset-0 bg-[radial-gradient(130%_105%_at_50%_50%,transparent_66%,rgba(255,244,230,0.42)_100%)]"
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(59,39,27,0.1),rgba(255,255,255,0)_44%)]" aria-hidden="true" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,246,236,0),rgba(255,239,223,0.38)_92%)]" aria-hidden="true" />
                <div className="absolute inset-0 bg-[radial-gradient(92%_80%_at_50%_96%,rgba(255,236,215,0.24),rgba(255,236,215,0))]" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </FadeInSection>
    </section>
  );
}