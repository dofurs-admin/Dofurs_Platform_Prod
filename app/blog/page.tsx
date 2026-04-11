import type { Metadata } from 'next';
import ContentPageLayout from '@/components/ContentPageLayout';
import Link from 'next/link';
import { blogPosts } from '@/lib/blog-posts';

export const metadata: Metadata = {
  title: 'Blog — Dofurs',
  description: 'Tips, guides, and stories about pet care, grooming, training, and more from the Dofurs team.',
  openGraph: { title: 'Blog — Dofurs', description: 'Pet care tips, guides, and stories.' },
};

export default function BlogPage() {
  const [featured, ...rest] = blogPosts;
  return (
    <ContentPageLayout
      title="Blog"
      description="Expert guides, care tips, and practical advice that help pet parents make confident care decisions."
      heroImageSrc="/Birthday/Blog_new.png"
      heroImageAlt="Dofurs blog"
    >
      {/* Featured post */}
      {featured && (
        <article className="rounded-3xl border border-[#f1e6da] bg-[linear-gradient(135deg,#fffdfb,#fff8f0)] p-6 shadow-soft-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg md:p-8">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-700">Featured</span>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink/70">
            <span className="rounded-full border border-[#f1e6da] bg-[#fffaf6] px-3 py-1 font-medium text-ink/80">{featured.category}</span>
            <span>{featured.readTime}</span>
            <span>•</span>
            <span>{featured.publishedOn}</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold leading-tight text-ink sm:text-3xl">{featured.title}</h2>
          <p className="mt-3 text-ink/75 md:text-[16px] md:leading-7">{featured.excerpt}</p>
          <Link
            href={`/blog/${featured.slug}`}
            className="mt-5 inline-flex rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_10px_22px_rgba(227,154,93,0.35)]"
          >
            Read article →
          </Link>
        </article>
      )}

      {/* Rest of posts in grid */}
      <div className="grid gap-5 sm:grid-cols-2">
        {rest.map((post) => (
          <article key={post.slug} className="rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 shadow-soft-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg">
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink/70">
              <span className="rounded-full border border-[#f1e6da] bg-[#fffaf6] px-3 py-1 font-medium text-ink/80">{post.category}</span>
              <span>{post.readTime}</span>
              <span>•</span>
              <span>{post.publishedOn}</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold leading-tight text-ink">{post.title}</h2>
            <p className="mt-2 line-clamp-3 text-sm text-ink/75">{post.excerpt}</p>
            <Link
              href={`/blog/${post.slug}`}
              className="mt-4 inline-flex rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_10px_22px_rgba(227,154,93,0.35)]"
            >
              Read article →
            </Link>
          </article>
        ))}
      </div>
    </ContentPageLayout>
  );
}
