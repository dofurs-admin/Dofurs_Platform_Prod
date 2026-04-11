import Image from 'next/image';
import Link from 'next/link';
import { PawPrint } from 'lucide-react';
import FadeInSection from './FadeInSection';
import { links } from '@/lib/site-data';

export default function ProviderSection() {
  return (
    <section id="providers" className="scroll-mt-24 bg-[#f8f5f2] py-20">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] px-6 py-10 shadow-soft sm:px-8 md:px-10 md:py-12 lg:px-14 lg:py-14">
            <PawPrint className="absolute left-8 top-8 h-7 w-7 text-[#e9c7ad]/25" aria-hidden="true" />
            <PawPrint className="absolute right-10 top-14 h-6 w-6 rotate-12 text-[#e9c7ad]/20" aria-hidden="true" />
            <PawPrint className="absolute bottom-10 right-1/3 h-6 w-6 -rotate-12 text-[#e9c7ad]/20" aria-hidden="true" />

            <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div className="relative mx-auto w-full max-w-xl">
                <div className="group relative aspect-[4/3] overflow-hidden rounded-[20px] shadow-xl">
                  <Image
                    src="/Birthday/partners-with-dofurs.png"
                    alt="Partner with Dofurs"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover object-[center_36%] transition duration-300 ease-out group-hover:scale-[1.02]"
                    priority
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjZjVlNmQ4Ii8+PC9zdmc+"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-l from-[#f6efe9]/70 via-[#f6efe9]/20 to-transparent"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="text-center lg:text-left">
                <h2 className="text-[30px] font-bold tracking-tight text-[#1f1f1f] sm:text-4xl lg:text-5xl">
                  Partner With Dofurs
                </h2>

                <p className="mx-auto mt-4 max-w-[520px] text-base leading-relaxed text-[#6b6b6b] sm:text-lg lg:mx-0">
                  Grow your pet care business with quality leads, reliable tools, and a platform built around trust. Join
                  our network of verified service providers and connect with pet parents who value excellence.
                </p>

                <div className="mt-8 flex flex-col items-center gap-4 lg:items-start">
                  <Link
                    href={links.provider}
                    className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(227,154,93,0.35)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:brightness-95 hover:shadow-[0_14px_30px_rgba(227,154,93,0.42)] sm:w-auto"
                    aria-label="Apply as Service Provider"
                  >
                    Apply as Service Provider
                  </Link>

                  <p className="text-sm text-[#7a7a7a]">Trusted by 200+ verified service professionals</p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
