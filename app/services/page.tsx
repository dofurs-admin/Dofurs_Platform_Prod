import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Pet Services — Dofurs',
  description: 'Explore grooming, veterinary, training, walking, and pet sitting services from verified professionals in Bangalore.',
  openGraph: { title: 'Pet Services — Dofurs', description: 'Explore pet services from verified professionals in Bangalore.' },
};

const SERVICE_CATEGORIES = [
  {
    slug: 'grooming',
    label: 'Pet Grooming',
    description: 'Professional baths, haircuts, nail trimming, and full grooming sessions at home or salon.',
    icon: '✂️',
    color: 'border-pink-200 bg-pink-50/60',
    iconBg: 'bg-pink-100',
  },
  {
    slug: 'vet-visits',
    label: 'Vet Visits',
    description: 'Trusted vets for wellness checkups, vaccinations, and health consultations.',
    icon: '🩺',
    color: 'border-blue-200 bg-blue-50/60',
    iconBg: 'bg-blue-100',
  },
  {
    slug: 'pet-sitting',
    label: 'Pet Sitting',
    description: 'Reliable sitters who care for your pets while you travel or work.',
    icon: '🏡',
    color: 'border-emerald-200 bg-emerald-50/60',
    iconBg: 'bg-emerald-100',
  },
  {
    slug: 'training',
    label: 'Dog Training',
    description: 'Positive reinforcement training to improve behavior and strengthen your bond.',
    icon: '🎓',
    color: 'border-amber-200 bg-amber-50/60',
    iconBg: 'bg-amber-100',
  },
  {
    slug: 'teleconsult',
    label: 'Vet Teleconsult',
    description: 'Quick online consultations with verified vets from the comfort of your home.',
    icon: '📱',
    color: 'border-purple-200 bg-purple-50/60',
    iconBg: 'bg-purple-100',
  },
];

export default function ServicesPage() {
  return (
    <>
      <Navbar />
      <main className="dofurs-mobile-main min-h-screen bg-[linear-gradient(180deg,#fffcf8_0%,#fffaf6_40%,#fffcf9_100%)] pt-20">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-coral">Dofurs Services</p>
            <h1 className="text-3xl font-bold text-neutral-950 sm:text-4xl">Find the Right Care</h1>
            <p className="mx-auto max-w-xl text-base text-neutral-600">
              Browse verified professionals across all service types in Bangalore.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/services/${cat.slug}`}
                className={`group flex flex-col gap-4 rounded-3xl border p-6 shadow-sm transition-all duration-200 hover:shadow-md ${cat.color}`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${cat.iconBg}`}>
                  {cat.icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 group-hover:text-coral">{cat.label}</h2>
                  <p className="mt-1 text-sm text-neutral-600">{cat.description}</p>
                </div>
                <span className="mt-auto text-sm font-semibold text-coral">
                  Browse Providers →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-14 rounded-3xl border border-brand-200 bg-[linear-gradient(135deg,#fff8f0_0%,#fffcf8_100%)] p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-neutral-900">Ready to book?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Start the booking flow to select your service, provider, and time slot in one seamless flow.
            </p>
            <Link
              href="/forms/customer-booking"
              className="mt-5 inline-block rounded-xl bg-[linear-gradient(135deg,#e49a57,#cf8347)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Book a Service
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
