import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ContentPageLayout from '@/components/ContentPageLayout';
import { blogPostBySlug, blogPosts } from '@/lib/blog-posts';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPostBySlug[slug];

  if (!post) {
    return { title: 'Blog | Dofurs' };
  }

  return {
    title: `${post.title} | Dofurs Blog`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = blogPostBySlug[slug];

  if (!post) {
    notFound();
  }

  return (
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
        <span>{post.publishedOn}</span>
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
        <h2 className="text-xl font-semibold text-ink">Need help with pet care right now?</h2>
        <p className="mt-2 text-ink/75">Book a verified service in minutes and get support tailored to your pet’s needs.</p>
        <Link
          href="/forms/customer-booking#start-your-booking"
          className="mt-4 inline-flex rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_10px_22px_rgba(227,154,93,0.35)]"
        >
          Book Premium Pet Care
        </Link>
      </div>
    </ContentPageLayout>
  );
}
