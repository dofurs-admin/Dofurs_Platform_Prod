import Image from 'next/image';
import { Clock3, Heart, House, MapPin, PawPrint, Sparkles, Star, type LucideIcon } from 'lucide-react';

type GroomingDoorstepBenefitsSectionProps = {
  locationName: string;
};

type BenefitCard = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
  titleIcon: LucideIcon;
  chipLabel: string;
  chipIcon: LucideIcon;
};

type BenefitStat = {
  value: string;
  label: string;
  icon: LucideIcon;
};

const benefitStats: BenefitStat[] = [
  { value: '100+', label: 'Happy pets groomed', icon: PawPrint },
  { value: '4.9', label: 'Average customer rating', icon: Star },
  { value: '100%', label: 'Home service convenience', icon: House },
];

export default function GroomingDoorstepBenefitsSection({ locationName }: GroomingDoorstepBenefitsSectionProps) {
  const benefitCards: BenefitCard[] = [
    {
      id: '01',
      imageSrc: '/v1.2.2/travel-1.png',
      imageAlt: `Pet parent choosing doorstep grooming in ${locationName}`,
      title: 'Relief from Bengaluru travel',
      description:
        'No long drives through traffic or summer heat. We come to your doorstep with the grooming setup.',
      titleIcon: MapPin,
      chipLabel: 'We come to your home',
      chipIcon: MapPin,
    },
    {
      id: '02',
      imageSrc: '/v1.2.2/waiting-time.png',
      imageAlt: `Pet parents waiting less for grooming in ${locationName}`,
      title: 'Save waiting time',
      description: 'No queues. No salon delays. Pick a convenient slot and keep the day moving.',
      titleIcon: Clock3,
      chipLabel: 'Your time is precious',
      chipIcon: Clock3,
    },
    {
      id: '03',
      imageSrc: '/v1.2.2/stress-free-for-pets.png',
      imageAlt: 'Pet staying calm during a doorstep grooming session',
      title: 'Stress-free for pets',
      description: 'Pets stay comfortable in their familiar environment while grooming happens at their pace.',
      titleIcon: Heart,
      chipLabel: 'Less stress. More comfort.',
      chipIcon: Heart,
    },
    {
      id: '04',
      imageSrc: '/v1.2.2/vacuum-trim.png',
      imageAlt: 'Modern grooming tools used at home for cleaner trims',
      title: 'Clean and modern grooming',
      description: 'Grooms, trims and vacuum support help reduce mess during coat care at home.',
      titleIcon: Sparkles,
      chipLabel: 'No mess. No cleanup.',
      chipIcon: Sparkles,
    },
  ];

  return (
    <section id="doorstep-benefits" className="scroll-mt-28 bg-[#f8f5f1] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e8ccb1] bg-[#fff9f3] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b613f] shadow-[0_6px_14px_rgba(93,57,28,0.07)]">
            <PawPrint className="h-3 w-3 text-coral" aria-hidden="true" />
            Professional pet grooming
          </span>
          <h2 className="mt-2.5 text-[28px] font-extrabold leading-[0.98] tracking-[-0.02em] text-[#111111] sm:text-[36px] lg:text-[40px]">
            <span>AT HOME.</span>{' '}
            <span className="text-[#e0841f]">STRESS-FREE</span>
          </h2>
          <p className="mx-auto mt-2 inline-flex max-w-[380px] items-center justify-center rounded-full bg-[#2d2018] px-4 py-1.5 text-[12px] font-semibold text-[#fff4e8] shadow-[0_8px_18px_rgba(38,26,18,0.2)]">
            Convenience for you | Comfort for your pet
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {benefitCards.map((card) => {
            const TitleIcon = card.titleIcon;
            const ChipIcon = card.chipIcon;

            return (
              <article
                key={card.id}
                className="flex h-full min-h-[290px] flex-col overflow-hidden rounded-[16px] border border-[#e4d8cc] bg-[#fffdfb] shadow-[0_8px_18px_rgba(82,57,35,0.07)]"
              >
                <div className="relative aspect-[16/8.6] overflow-hidden bg-[#f5e6d8]">
                  <Image src={card.imageSrc} alt={card.imageAlt} fill sizes="(max-width: 640px) 94vw, (max-width: 1280px) 48vw, 25vw" className="object-cover" />
                </div>

                <div className="flex flex-1 flex-col p-3.5">
                  <div className="flex min-h-[40px] items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#f4dfcb] bg-[#fff6ec] text-[#d88a42]">
                      <TitleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <h3 className="text-[16px] font-bold leading-[1.18] text-[#1d1d1d] sm:text-[17px]">{card.title}</h3>
                  </div>
                  <p className="mt-1.5 min-h-[50px] text-[11.5px] leading-[18px] text-[#5f4f43]">{card.description}</p>
                  <p className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-[#f0dfcf] bg-[#fff8f0] px-2.5 py-1 text-[11px] font-semibold text-[#b06c39]">
                    <ChipIcon className="h-3 w-3" aria-hidden="true" />
                    {card.chipLabel}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-3 overflow-hidden rounded-[18px] border border-[#e4d1bd] bg-white shadow-[0_8px_18px_rgba(93,57,28,0.07)]">
          <div className="grid sm:grid-cols-3">
            {benefitStats.map((stat, index) => {
              const Icon = stat.icon;
              const borderClass = index < benefitStats.length - 1 ? 'sm:border-r sm:border-[#f0dfcf]' : '';

              return (
                <div key={stat.label} className={`flex items-center justify-center gap-2.5 px-4 py-2.5 ${borderClass}`}>
                  <Icon className="h-5 w-5 shrink-0 text-[#d98d45]" aria-hidden="true" />
                  <div>
                    <p className="text-[28px] font-extrabold leading-[0.92] tracking-[-0.01em] text-[#121212]">{stat.value}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#5b5149] sm:text-[12px]">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}