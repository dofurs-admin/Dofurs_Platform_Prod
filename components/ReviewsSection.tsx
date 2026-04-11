import FadeInSection from './FadeInSection';
import { reviews } from '@/lib/site-data';
import { theme } from '@/lib/theme';
import { Star } from 'lucide-react';

export default function ReviewsSection() {
  return (
    <section className="bg-[#fdf8f4] py-16 md:py-20">
      <div className={theme.layout.container}>
        <FadeInSection>
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">What Pet Parents Say</h2>
          <p className="mt-3 max-w-3xl text-ink/75">Real feedback from families who trust Dofurs for pet care.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {reviews.map((item) => (
              <article key={item.name} className="group rounded-2xl border border-[#f1e6da] bg-white p-6 shadow-soft transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.10)]">
                <div className="mb-3 flex items-center gap-1.5 text-[#d4a73b]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className="fill-current" aria-hidden="true" />
                  ))}
                </div>
                <p className="text-[15px] leading-7 text-ink/82">“{item.quote}”</p>
                <p className="mt-5 text-sm font-semibold tracking-wide text-ink">{item.name}</p>
                <p className="text-xs font-medium text-ink/60">{item.role}</p>
                {item.service && (
                  <p className="mt-1.5 inline-block rounded-full border border-[#f1e6da] bg-[#fffaf6] px-2.5 py-0.5 text-[10px] font-semibold text-[#8b633f]">{item.service}</p>
                )}
              </article>
            ))}
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
