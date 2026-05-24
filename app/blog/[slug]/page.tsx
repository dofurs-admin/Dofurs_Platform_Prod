import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ContentPageLayout from '@/components/ContentPageLayout';
import {
  blogPostBySlug,
  blogPosts,
  getRelatedPosts,
  type BlogPost,
} from '@/lib/blog-posts';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

const SITE_URL = 'https://dofurs.in';

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPostBySlug[slug];

  if (!post) {
    return { title: 'Blog | Dofurs' };
  }

  const canonical = `/blog/${post.slug}`;
  const ogImage = post.heroImageSrc.startsWith('http')
    ? post.heroImageSrc
    : `${SITE_URL}${post.heroImageSrc}`;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical },
    keywords: post.tags,
    authors: [{ name: post.author ?? 'Dofurs Editorial' }],
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `${SITE_URL}${canonical}`,
      siteName: 'Dofurs',
      locale: 'en_IN',
      images: [
        {
          url: ogImage,
          alt: post.heroImageAlt,
        },
      ],
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified ?? post.datePublished,
      authors: [post.author ?? 'Dofurs Editorial'],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [ogImage],
    },
  };
}

function buildBlogPostingSchema(post: BlogPost) {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = post.heroImageSrc.startsWith('http')
    ? post.heroImageSrc
    : `${SITE_URL}${post.heroImageSrc}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#blogposting`,
    headline: post.title,
    description: post.excerpt,
    image,
    datePublished: post.datePublished ?? post.publishedOn,
    dateModified: post.dateModified ?? post.datePublished ?? post.publishedOn,
    keywords: post.tags,
    articleSection: post.category,
    inLanguage: 'en-IN',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author: {
      '@type': 'Organization',
      name: post.author ?? 'Dofurs Editorial',
      url: SITE_URL,
    },
    publisher: { '@id': `${SITE_URL}/#organization` },
    url,
  };
}

function buildBreadcrumbSchema(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `${SITE_URL}/blog/${post.slug}`,
      },
    ],
  };
}

// HowTo schemas keyed by blog slug — rendered alongside BlogPosting + BreadcrumbList
// so step-by-step posts qualify for HowTo rich results in Google.
const howToSchemaBySlug: Record<string, Record<string, unknown>> = {
  'emergency-pet-care-bangalore': {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to handle a pet emergency in Bangalore before the vet arrives',
    description:
      'First-response steps for Bangalore pet parents facing a pet emergency — stay calm, secure the environment, assess your pet, call a vet, stabilise, and transport safely.',
    image: 'https://dofurs.in/blog/emergency-pet-care-bangalore.svg',
    totalTime: 'PT15M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Stay calm and secure the environment',
        text: 'Remove hazards, separate other pets, and keep the area quiet so your pet does not panic further.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Do a quick primary check',
        text: 'Look for bleeding, breathing trouble, consciousness changes, and obvious injuries. Note what you see for the vet.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Call a 24×7 vet in Bangalore',
        text: 'Phone an emergency vet (Cessna, CUPA, Dr.Dilip, or your regular clinic) and describe symptoms clearly — do not drive without calling first.',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Stabilise with first-aid basics',
        text: 'Apply firm pressure to bleeding wounds with clean cloth, keep the pet warm, and do not give food, water, or human medicine unless instructed.',
      },
      {
        '@type': 'HowToStep',
        position: 5,
        name: 'Transport safely',
        text: 'Use a carrier, a rigid board for large dogs with suspected spinal injury, and bring any ingested substance packaging with you.',
      },
    ],
  },
  'puppy-vaccination-schedule-india': {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to follow the puppy vaccination schedule in India',
    description:
      'A step-by-step India-specific puppy vaccination schedule covering core DHPPiL, Anti-Rabies, Corona, KC, and annual boosters — with week-by-week timing.',
    image: 'https://dofurs.in/blog/puppy-vaccination-schedule-india.svg',
    totalTime: 'P6M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'First vet visit at 6–8 weeks',
        text: 'Book a wellness check and start the DHPPi (or DHPPiL) core vaccination. Confirm deworming schedule.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Second dose at 10–12 weeks',
        text: 'Second DHPPi booster plus first Anti-Rabies vaccine. Avoid outdoor walks until fully vaccinated.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Third dose at 14–16 weeks',
        text: 'Final DHPPiL booster plus second Anti-Rabies. Add Corona and Kennel Cough if your vet recommends.',
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Six-month and annual boosters',
        text: 'Schedule first annual booster 12 months after the final puppy shot. Maintain vaccination certificate for travel.',
      },
    ],
  },
};

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = blogPostBySlug[slug];

  if (!post) {
    notFound();
  }

  const blogPostingSchema = buildBlogPostingSchema(post);
  const breadcrumbSchema = buildBreadcrumbSchema(post);
  const howToSchema = howToSchemaBySlug[post.slug];
  const relatedPosts = getRelatedPosts(post.slug, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {howToSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
        />
      ) : null}
      <ContentPageLayout
        title={post.title}
        description={post.excerpt}
        heroImageSrc={post.heroImageSrc}
        heroImageAlt={post.heroImageAlt}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink/70">
          <span className="rounded-full border border-[#f1e6da] bg-[#fffaf6] px-3 py-1 font-medium text-ink/80">{post.category}</span>
          <span>{post.readTime}</span>
          <span>•</span>
          <span>
            Published on <time dateTime={post.datePublished}>{post.publishedOn}</time>
          </span>
          {post.dateModified && post.dateModified !== post.datePublished ? (
            <>
              <span>•</span>
              <span>
                Updated <time dateTime={post.dateModified}>{formatIsoDate(post.dateModified)}</time>
              </span>
            </>
          ) : null}
        </div>

        {post.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-2xl font-semibold text-ink">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul className="list-disc space-y-2 pl-6">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <div className="mt-3 rounded-3xl border border-[#f2dfcf] bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] p-6 shadow-soft-sm">
          <h2 className="text-xl font-semibold text-ink">Need help with grooming right now?</h2>
          <p className="mt-2 text-ink/75">
            Book verified doorstep grooming in Bangalore in minutes, with transparent packages and pet-safe products.
          </p>
          <Link
            href="/forms/customer-booking?serviceType=grooming&mode=home_visit#start-your-booking"
            className="mt-4 inline-flex rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_10px_22px_rgba(227,154,93,0.35)]"
          >
            Book Now
          </Link>
        </div>

        {relatedPosts.length > 0 ? (
          <section aria-labelledby="related-articles" className="mt-4 space-y-4">
            <h2 id="related-articles" className="text-2xl font-semibold text-ink">
              Related articles
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((related) => (
                <article
                  key={related.slug}
                  className="rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-5 shadow-soft-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink/70">
                    <span className="rounded-full border border-[#f1e6da] bg-[#fffaf6] px-2 py-0.5 font-medium text-ink/80">
                      {related.category}
                    </span>
                    <span>{related.readTime}</span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold leading-snug text-ink">
                    <Link href={`/blog/${related.slug}`} className="hover:underline">
                      {related.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm text-ink/75">{related.excerpt}</p>
                  <Link
                    href={`/blog/${related.slug}`}
                    className="mt-3 inline-flex text-sm font-semibold text-coral hover:underline"
                  >
                    Read article →
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </ContentPageLayout>
    </>
  );
}

function formatIsoDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
