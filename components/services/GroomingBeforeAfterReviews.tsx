import Image from 'next/image';
import Link from 'next/link';
import { CalendarCheck2, CheckCircle2, Instagram, MessageCircle, Sparkles, Star } from 'lucide-react';

type GroomingBeforeAfterReviewsProps = {
  bookingHref: string;
  locationName: string;
  questionsHref?: string;
  compact?: boolean;
};

type GroomingReview = {
  petName: string;
  location: string;
  packageName: string;
  result: string;
  quote: string;
  beforeImage: string;
  afterImage: string;
  beforeAlt: string;
  afterAlt: string;
};

const ratingStars = [1, 2, 3, 4, 5];
const INSTAGRAM_URL = 'https://www.instagram.com/dofurs.petcare/';

const groomingReviews: GroomingReview[] = [
  {
    petName: 'Bruno',
    location: 'Whitefield',
    packageName: 'Complete Care',
    result: 'De-shedding, bath care and coat shaping',
    quote: 'The home grooming session made Bruno lighter, cleaner and much easier to brush through the week.',
    beforeImage: '/v1.2.2/Labra Before.webp',
    afterImage: '/v1.2.2/Labra After .webp',
    beforeAlt: 'Golden retriever before a Dofurs doorstep grooming session',
    afterAlt: 'Golden retriever after a Dofurs doorstep grooming session',
  },
  {
    petName: 'Coco',
    location: 'HSR Layout',
    packageName: 'Fur Makeover',
    result: 'Curl trim, face cleanup and hygiene grooming',
    quote: 'Coco looked neat without losing the soft doodle shape we wanted. The groomer checked every step before trimming.',
    beforeImage: '/v1.2.2/Before Doodle.webp',
    afterImage: '/v1.2.2/after Doodle.webp',
    beforeAlt: 'Doodle before a Dofurs fur makeover grooming session',
    afterAlt: 'Doodle after a Dofurs fur makeover grooming session',
  },
  {
    petName: 'Milo',
    location: 'Indiranagar',
    packageName: 'Essential Grooming',
    result: 'Haircut, paw cleaning and hygiene trim',
    quote: 'The haircut was tidy, the nails were finished well, and Milo stayed comfortable because everything happened at home.',
    beforeImage: '/v1.2.2/shihzu before.webp',
    afterImage: '/v1.2.2/shihzu after.webp',
    beforeAlt: 'Shih Tzu before a Dofurs essential grooming session',
    afterAlt: 'Shih Tzu after a Dofurs essential grooming session',
  },
];

export default function GroomingBeforeAfterReviews({
  bookingHref,
  locationName,
  questionsHref = '#questions-before-booking',
  compact = false,
}: GroomingBeforeAfterReviewsProps) {
  const locationContext = locationName === 'Bengaluru' ? 'Bengaluru homes' : `${locationName} homes`;

  const sectionClassName = compact
    ? 'scroll-mt-28 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf6_48%,#ffffff_100%)] py-10 md:py-11'
    : 'scroll-mt-28 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf6_48%,#ffffff_100%)] px-4 py-12 sm:px-6 md:py-14 lg:px-8';

  const wrapperClassName = compact ? 'mx-auto w-full max-w-none' : 'mx-auto w-full max-w-[1200px]';

  const layoutClassName = compact
    ? 'grid gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-start xl:gap-6'
    : 'grid gap-7 lg:grid-cols-[0.68fr_1.32fr] lg:items-start xl:grid-cols-[0.62fr_1.38fr] xl:gap-8';

  const leftPanelClassName = compact
    ? 'rounded-[20px] border border-[#ead6c3] bg-white/90 p-4 shadow-[0_12px_26px_rgba(93,57,28,0.07)] sm:p-5'
    : 'rounded-[24px] border border-[#ead6c3] bg-white/90 p-5 shadow-[0_14px_34px_rgba(93,57,28,0.08)] sm:p-6 lg:sticky lg:top-24';

  const cardGridClassName = compact ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4 sm:grid-cols-2 min-[1180px]:grid-cols-3';

  const cardClassName = compact
    ? 'flex h-full flex-col overflow-hidden rounded-[18px] border border-[#ead6c3] bg-white shadow-[0_10px_22px_rgba(93,57,28,0.07)] transition-shadow duration-300 hover:shadow-[0_14px_30px_rgba(93,57,28,0.1)]'
    : 'flex h-full flex-col overflow-hidden rounded-[22px] border border-[#ead6c3] bg-white shadow-[0_14px_30px_rgba(93,57,28,0.08)] transition-shadow duration-300 hover:shadow-[0_18px_36px_rgba(93,57,28,0.12)]';

  return (
    <section id="grooming-reviews" className={sectionClassName}>
      <div className={wrapperClassName}>
        <div className={layoutClassName}>
          <div className={leftPanelClassName}>
            <span className={`inline-flex items-center gap-2 rounded-full border border-[#ead7c5] bg-[#fff8f0] px-3 py-1.5 font-semibold uppercase text-[#8a6549] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
              <Sparkles className={compact ? 'h-3 w-3 text-coral' : 'h-3.5 w-3.5 text-coral'} aria-hidden="true" />
              Before and after reviews
            </span>
            <h2 className={compact ? 'mt-2.5 text-[23px] font-bold leading-[1.08] text-[#2f261f] md:text-[27px]' : 'mt-3 text-[28px] font-bold leading-[1.08] text-[#2f261f] md:text-[34px]'}>
              Visible grooming transformations from {locationContext}
            </h2>
            <p className={compact ? 'mt-2.5 text-[12px] leading-5 text-[#6b5a4e]' : 'mt-3 text-[13px] leading-6 text-[#6b5a4e]'}>
              See how doorstep grooming changes coat shape, shedding, paw hygiene and everyday comfort without making pets travel to a salon.
            </p>

            <div className={`grid gap-2 font-semibold text-[#5d4739] sm:grid-cols-2 lg:grid-cols-1 ${compact ? 'mt-4 text-[11px]' : 'mt-5 text-[12px]'}`}>
              {['Before and after image records', 'Doorstep bath, trim and coat care', 'Package matched to coat condition'].map((item) => (
                <div key={item} className={`flex items-center gap-2 rounded-xl border border-[#f0dfcf] bg-[#fffaf6] ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                  <CheckCircle2 className={compact ? 'h-3.5 w-3.5 shrink-0 text-coral' : 'h-4 w-4 shrink-0 text-coral'} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className={`flex flex-wrap ${compact ? 'mt-4 gap-2.5' : 'mt-5 gap-3'}`}>
              <Link href={bookingHref} className={`inline-flex items-center justify-center gap-2 rounded-full border border-[#de9158] bg-[linear-gradient(135deg,#de9158,#c7773b)] font-semibold text-white shadow-[0_12px_24px_rgba(199,119,59,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(199,119,59,0.26)] ${compact ? 'h-10 px-4 text-[13px]' : 'h-11 px-5 text-sm'}`}>
                <CalendarCheck2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
                Book Grooming
              </Link>
              <Link href={questionsHref} className={`inline-flex items-center justify-center gap-2 rounded-full border border-[#e0c4a8] bg-white font-semibold text-[#7c5335] transition hover:-translate-y-0.5 hover:border-[#c7773b] hover:bg-[#fffaf5] hover:text-[#c7773b] ${compact ? 'h-10 px-4 text-[13px]' : 'h-11 px-5 text-sm'}`}>
                <MessageCircle className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
                Questions
              </Link>
            </div>
          </div>

          <div className={compact ? 'space-y-3' : 'space-y-4'}>
            <div className={cardGridClassName}>
              {groomingReviews.map((review, index) => (
                <article
                  key={review.petName}
                  className={`${cardClassName}${compact && index === groomingReviews.length - 1 ? ' sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-[360px] lg:col-span-1 lg:mx-0 lg:max-w-none' : ''}`}
                >
                  <div className="grid grid-cols-2 gap-px bg-[#ead6c3]">
                    {[
                      { label: 'Before', src: review.beforeImage, alt: review.beforeAlt },
                      { label: 'After', src: review.afterImage, alt: review.afterAlt },
                    ].map((image) => (
                      <figure key={image.label} className="relative aspect-square overflow-hidden bg-[#fff8f0]">
                        <Image
                          src={image.src}
                          alt={image.alt}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1180px) 24vw, 170px"
                          className="object-cover"
                        />
                        <figcaption className={`absolute left-2 top-2 rounded-full border border-white/70 bg-white/90 font-bold uppercase text-[#6f4c34] shadow-[0_6px_16px_rgba(47,38,31,0.14)] ${compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'}`}>
                          {image.label}
                        </figcaption>
                      </figure>
                    ))}
                  </div>

                  <div className={compact ? 'flex flex-1 flex-col p-3.5' : 'flex flex-1 flex-col p-4'}>
                    <div className="flex flex-col gap-2">
                      <div>
                        <h3 className={compact ? 'text-[15px] font-bold leading-tight text-neutral-950' : 'text-base font-bold leading-tight text-neutral-950'}>{review.petName}</h3>
                        <div className={compact ? 'mt-1 min-h-[26px] text-[10px] font-semibold uppercase leading-tight text-[#8b633f]' : 'mt-1 min-h-[28px] text-[11px] font-semibold uppercase leading-tight text-[#8b633f]'}>
                          <p>{review.location}</p>
                          <p>{review.packageName}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 text-[#d19a32]" aria-hidden="true">
                        {ratingStars.map((star) => (
                          <Star key={star} className={compact ? 'h-3 w-3 fill-current' : 'h-3.5 w-3.5 fill-current'} aria-hidden="true" />
                        ))}
                      </div>
                      <span className="sr-only">Five star grooming review</span>
                    </div>

                    <p className={compact ? 'mt-2.5 min-h-[72px] text-[12px] leading-5 text-[#5f5047]' : 'mt-3 min-h-[84px] text-[13px] leading-6 text-[#5f5047]'}>&quot;{review.quote}&quot;</p>
                    <div className={compact ? 'mt-auto pt-2.5' : 'mt-auto pt-3'}>
                      <p className={compact ? 'rounded-xl border border-[#f0dfcf] bg-[#fffaf6] px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-[#6f4c34]' : 'rounded-xl border border-[#f0dfcf] bg-[#fffaf6] px-3 py-2 text-[12px] font-semibold leading-5 text-[#6f4c34]'}>
                        {review.result}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col justify-center gap-3 border border-[#e0c4a8] bg-white/92 text-[#6f4c34] shadow-[0_12px_28px_rgba(93,57,28,0.07)] transition hover:border-[#c7773b] hover:bg-[#fffaf5] hover:text-[#c7773b] hover:shadow-[0_16px_32px_rgba(93,57,28,0.1)] sm:flex-row sm:items-center sm:justify-between ${compact ? 'min-h-[56px] rounded-[16px] p-3.5' : 'min-h-[68px] rounded-[20px] p-4'}`}
            >
              <span className={`flex min-w-0 items-center ${compact ? 'gap-2.5' : 'gap-3'}`}>
                <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#de9158,#c7773b)] text-white shadow-[0_10px_20px_rgba(199,119,59,0.22)] ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}>
                  <Instagram className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className={compact ? 'block text-[13px] font-bold text-neutral-950' : 'block text-sm font-bold text-neutral-950'}>See more image reviews on Instagram</span>
                  <span className={compact ? 'mt-0.5 block text-[11px] font-semibold leading-4 text-[#7b6251]' : 'mt-0.5 block text-[12px] font-semibold leading-5 text-[#7b6251]'}>Explore more Dofurs grooming before-and-after results.</span>
                </span>
              </span>
              <span className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[#e0c4a8] bg-[#fff8f0] font-bold uppercase text-[#7c5335] ${compact ? 'h-8 px-3.5 text-[11px]' : 'h-9 px-4 text-[12px]'}`}>
                Open Instagram
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}