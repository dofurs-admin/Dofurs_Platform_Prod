import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, HelpCircle, FileText, Bath, Stethoscope, HeartHandshake, Dog, Search } from 'lucide-react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { services, links } from '@/lib/site-data';
import { blogPosts } from '@/lib/blog-posts';
import { premiumPrimaryCtaClass } from '@/lib/styles/premium-cta';

export const metadata: Metadata = {
  title: 'Search — Dofurs',
  description: 'Search for pet services, providers, and information on Dofurs.',
};

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const faqs = [
  { question: 'How do I book a service?', answer: 'Go to the booking section, open the booking form, submit details, and our team will confirm availability.' },
  { question: 'How are providers verified?', answer: 'We review profile details, service information, and onboarding checks before providers are listed for bookings.' },
  { question: 'Can I cancel or reschedule?', answer: 'Yes, cancellation and rescheduling are supported under our cancellation and adjustment policy.' },
  { question: 'Do you support birthday event bookings?', answer: 'Yes, birthday celebration requests are available through our dedicated birthday booking form.' },
  { question: 'What areas do you serve?', answer: 'We currently serve Bangalore. Enter your pincode in the header to check availability.' },
  { question: 'How do I pay for services?', answer: 'Payment can be made directly to the provider at the time of service or through the Dofurs platform.' },
  { question: 'What if I am not satisfied with a service?', answer: 'Contact us within 24 hours of the service and we will work with the provider to resolve any concerns.' },
  { question: 'How do I add or edit my pet profiles?', answer: 'Go to your Dashboard and click "Pet Profiles" to add new pets or edit existing ones.' },
  { question: 'Is my personal information secure?', answer: 'Yes, we use industry-standard encryption. Your data is stored securely and never shared without consent.' },
  { question: 'How do I become a service provider on Dofurs?', answer: 'Visit our provider application form. We review applications and onboard qualified professionals.' },
];

const staticPages = [
  { title: 'About Dofurs', description: 'Our mission, team, and the story behind Dofurs.', href: '/about' },
  { title: 'Blog', description: 'Pet care tips, grooming guides, and expert advice.', href: '/blog' },
  { title: 'FAQs', description: 'Answers to the most common questions about our services.', href: '/faqs' },
  { title: 'Contact Us', description: 'Get in touch with our support team.', href: '/contact-us' },
  { title: 'Refer & Earn', description: 'Refer a friend to Dofurs and earn rewards.', href: '/refer-and-earn' },
  { title: 'Privacy Policy', description: 'How we handle and protect your personal data.', href: '/privacy-policy' },
  { title: 'Terms & Conditions', description: 'Our service terms and usage conditions.', href: '/terms-conditions' },
  { title: 'Become a Provider', description: 'Join the Dofurs network as a verified pet care professional.', href: links.provider },
];

const serviceIcons: Record<string, React.ElementType> = {
  Grooming: Bath,
  'Vet Visits': Stethoscope,
  'Pet Sitting': HeartHandshake,
  Training: Dog,
};

function matches(text: string, query: string) {
  return text.toLowerCase().includes(query.toLowerCase());
}

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const matchedServices = query
    ? services.filter((s) => matches(s.title, query) || matches(s.description, query))
    : [];

  const matchedPosts = query
    ? blogPosts.filter((p) => matches(p.title, query) || matches(p.excerpt, query) || matches(p.category, query))
    : [];

  const matchedFaqs = query
    ? faqs.filter((f) => matches(f.question, query) || matches(f.answer, query))
    : [];

  const matchedPages = query
    ? staticPages.filter((p) => matches(p.title, query) || matches(p.description, query))
    : [];

  const totalResults = matchedServices.length + matchedPosts.length + matchedFaqs.length + matchedPages.length;
  const hasQuery = query.length > 0;
  const bookCtaClass = premiumPrimaryCtaClass('h-9 px-4 text-xs font-semibold');

  return (
    <>
      <Navbar />
      <main className={`${plusJakarta.className} dofurs-mobile-main min-h-screen bg-[linear-gradient(180deg,#fffcf8_0%,#fffdfa_38%,#fffcf9_100%)] pt-24 text-ink`}>
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="pt-8">
            {hasQuery ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-coral">Search Results</p>
                <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.01em] text-[#2d221a] sm:text-4xl">
                  {totalResults > 0 ? (
                    <>{totalResults} result{totalResults !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;</>
                  ) : (
                    <>No results for &ldquo;{query}&rdquo;</>
                  )}
                </h1>
                {totalResults === 0 && (
                  <p className="mt-3 text-base text-[#675245]">
                    Try a different keyword — for example <span className="font-semibold text-[#3a2c22]">grooming</span>, <span className="font-semibold text-[#3a2c22]">vet</span>, or <span className="font-semibold text-[#3a2c22]">training</span>.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-coral">Search</p>
                <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.01em] text-[#2d221a] sm:text-4xl">
                  What are you looking for?
                </h1>
                <p className="mt-3 text-base text-[#675245]">Search for services, articles, FAQs, and more across Dofurs.</p>
              </>
            )}
          </div>

          {/* No query — show all categories as suggestions */}
          {!hasQuery && (
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((service) => {
                const Icon = serviceIcons[service.title] ?? Bath;
                return (
                  <Link
                    key={service.title}
                    href={`/search?q=${encodeURIComponent(service.title)}`}
                    className="flex items-center gap-3 rounded-2xl border border-[#e7c4a7] bg-white/80 p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-coral/40 hover:shadow-premium"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-coral">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-[#3a2c22]">{service.title}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Services */}
          {matchedServices.length > 0 && (
            <section className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Services</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {matchedServices.map((service) => {
                  const Icon = serviceIcons[service.title] ?? Bath;
                  return (
                    <article
                      key={service.title}
                      className="flex flex-col rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(165deg,rgba(255,255,255,0.5),rgba(255,250,244,0.2))] p-5 shadow-premium"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-coral">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h2 className="mt-3 text-base font-semibold text-[#3a2c22]">{service.title}</h2>
                      <p className="mt-1 flex-1 text-sm text-[#816b5d]">{service.description}</p>
                      <div className="mt-4">
                        <Link
                          href={`${links.booking}?serviceType=${encodeURIComponent(service.title)}#start-your-booking`}
                          className={bookCtaClass}
                        >
                          Book Now
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Blog Posts */}
          {matchedPosts.length > 0 && (
            <section className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Articles</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matchedPosts.map((post) => (
                  <article
                    key={post.slug}
                    className="flex flex-col rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(165deg,rgba(255,255,255,0.5),rgba(255,250,244,0.2))] p-5 shadow-premium"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0 text-coral" />
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-coral">
                        {post.category}
                      </span>
                    </div>
                    <h2 className="mt-3 flex-1 text-sm font-semibold leading-snug text-[#3a2c22]">{post.title}</h2>
                    <p className="mt-1.5 text-xs text-[#816b5d] line-clamp-2">{post.excerpt}</p>
                    <div className="mt-4">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="text-xs font-semibold text-coral underline-offset-2 hover:underline"
                      >
                        Read Article →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* FAQs */}
          {matchedFaqs.length > 0 && (
            <section className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">FAQs</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {matchedFaqs.map((faq) => (
                  <article
                    key={faq.question}
                    className="rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(165deg,rgba(255,255,255,0.5),rgba(255,250,244,0.2))] p-5 shadow-premium"
                  >
                    <div className="flex items-start gap-3">
                      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                      <div>
                        <p className="text-sm font-semibold text-[#3a2c22]">{faq.question}</p>
                        <p className="mt-1.5 text-sm text-[#816b5d] line-clamp-2">{faq.answer}</p>
                      </div>
                    </div>
                    <div className="mt-3 pl-7">
                      <Link href="/faqs" className="text-xs font-semibold text-coral underline-offset-2 hover:underline">
                        View all FAQs →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Pages */}
          {matchedPages.length > 0 && (
            <section className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Pages</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {matchedPages.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    className="flex items-start gap-3 rounded-[20px] border border-[#e7c4a7] bg-[linear-gradient(165deg,rgba(255,255,255,0.5),rgba(255,250,244,0.2))] p-4 shadow-premium transition hover:-translate-y-0.5 hover:shadow-premium-lg"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                    <div>
                      <p className="text-sm font-semibold text-[#3a2c22]">{page.title}</p>
                      <p className="mt-0.5 text-xs text-[#816b5d]">{page.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* No results CTA */}
          {hasQuery && totalResults === 0 && (
            <div className="mt-12 rounded-[24px] border border-[#e7c4a7] bg-[linear-gradient(140deg,#fff6eb,#fffdf8)] p-8 text-center shadow-premium">
              <Search className="mx-auto h-8 w-8 text-coral/50" />
              <p className="mt-3 text-base font-semibold text-[#3a2c22]">Not finding what you need?</p>
              <p className="mt-1 text-sm text-[#816b5d]">Browse all our services or get in touch with our team.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href={links.booking} className={premiumPrimaryCtaClass('h-10 px-5 text-sm font-semibold')}>
                  Browse Services
                </Link>
                <Link
                  href="/contact-us"
                  className="inline-flex h-10 items-center rounded-full border border-[#e7c4a7] bg-white px-5 text-sm font-semibold text-[#4a392d] transition hover:border-coral/40 hover:text-coral"
                >
                  Contact Us
                </Link>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center rounded-full border border-[#e7c4a7] bg-white px-5 text-sm font-semibold text-[#4a392d] transition hover:border-coral/40 hover:text-coral"
                >
                  Go Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
