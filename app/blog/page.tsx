import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_CATEGORIES, BLOG_ORIGIN, featuredPost, filterPosts, jsonLdScript, readingMinutes, type BlogPost } from '@/lib/blog/posts';
import { BLOG_PUBLIC } from '@/lib/blog/public-copy';
import { publishedPosts } from '@/lib/blog/load';
import { CardThumb } from '@/components/blog/article';

export const revalidate = 3600;

function essayMeta(post: BlogPost): string {
  const when = new Date(post.publishedAt ?? post.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${when} · ${readingMinutes(post.body)} ${BLOG_PUBLIC.minRead}`;
}

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Essays from Poket School on ET AI, families, and schools. Primary, Secondary, IGCSE, and A-Level, in plain language.',
  alternates: {
    canonical: '/blog',
    types: { 'application/rss+xml': '/blog/feed.xml' },
  },
  openGraph: {
    type: 'website',
    url: '/blog',
    title: 'Poket School Blog',
    description: 'Essays from Poket School and ET AI.',
    siteName: 'Poket School',
  },
};

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q : '';
  const category = typeof params.category === 'string' ? params.category : 'All';
  const posts = await publishedPosts();
  const matching = filterPosts(posts, query, category);
  const featured = category === 'All' && !query.trim() ? featuredPost(posts) : null;
  const rest = featured ? matching.filter((post) => post.slug !== featured.slug) : matching;
  const blogLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Poket School Blog',
    url: `${BLOG_ORIGIN}/blog`,
    description: 'Essays from Poket School and ET AI.',
    publisher: { '@type': 'Organization', name: 'Poket School', url: BLOG_ORIGIN },
  };

  return (
    <main id="content" className="min-h-screen bg-[#F8F4EE] text-[#203337]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(blogLd) }} />
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <p className="text-xs font-bold tracking-[0.22em] text-primary">POKET SCHOOL</p>
        <h1 className="mt-3 max-w-3xl font-heading text-4xl tracking-tight sm:text-6xl">The journal</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#203337]/75">
          Notes on learning with ET AI. Pathways stay named Primary, Secondary, IGCSE, and A-Level.
        </p>

        <form action="/blog" className="mt-8 flex flex-col gap-3 sm:flex-row" role="search">
          <label className="sr-only" htmlFor="blog-search">Search essays</label>
          <input
            id="blog-search"
            name="q"
            defaultValue={query}
            placeholder="Search essays"
            className="min-h-12 flex-1 rounded-full border border-[#203337]/15 bg-white px-5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          />
          {category !== 'All' ? <input type="hidden" name="category" value={category} /> : null}
          <button type="submit" className="min-h-12 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">
            Search
          </button>
        </form>

        <nav aria-label="Categories" className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {['All', ...BLOG_CATEGORIES].map((name) => {
            const href = name === 'All' ? '/blog' : `/blog?category=${encodeURIComponent(name)}`;
            const active = category === name;
            return (
              <Link
                key={name}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${active ? 'bg-[#203337] text-white' : 'bg-white text-[#203337]/80'}`}
              >
                {name}
              </Link>
            );
          })}
        </nav>

        {featured ? (
          <article className="mt-8 overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_60px_-36px_rgba(32,51,55,0.45)]">
            <Link href={`/blog/${featured.slug}`}>
              <CardThumb post={featured} className="h-56 sm:h-72" />
            </Link>
            <div className="p-6 sm:p-8">
              <p className="text-xs font-bold tracking-[0.18em] text-primary">FEATURED · {featured.category}</p>
              <h2 className="mt-2 font-heading text-3xl tracking-tight sm:text-4xl">
                <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
              </h2>
              <p className="mt-3 max-w-2xl text-[#203337]/75">{featured.excerpt}</p>
              <p className="mt-3 text-sm text-[#203337]/60">{essayMeta(featured)}</p>
              <Link href={`/blog/${featured.slug}`} className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-primary">
                {BLOG_PUBLIC.read}
              </Link>
            </div>
          </article>
        ) : (
          <section className="mt-8 rounded-[2rem] border border-dashed border-[#203337]/20 bg-white/70 px-6 py-10 sm:px-10">
            <p className="text-xs font-bold tracking-[0.18em] text-[var(--ps-cyan-text)]">FEATURED</p>
            <h2 className="mt-2 font-heading text-3xl tracking-tight">The next essay is still on the desk</h2>
            <p className="mt-3 max-w-xl text-[#203337]/75">
              Published essays will appear here. The six drafts on the admin desk stay unpublished until a super admin publishes them.
            </p>
          </section>
        )}

        <ul className="mt-8 grid gap-4 sm:grid-cols-2" data-blog-grid="1">
          {rest.map((post) => (
            <li key={post.slug}>
              <article className="h-full overflow-hidden rounded-3xl bg-white">
                <Link href={`/blog/${post.slug}`}>
                  <CardThumb post={post} className="h-44" />
                </Link>
                <div className="p-5">
                  <p className="text-xs font-bold tracking-wider text-primary">{post.category}</p>
                  <h2 className="mt-2 font-heading text-2xl tracking-tight">
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#203337]/70">{post.excerpt}</p>
                  <p className="mt-3 text-sm text-[#203337]/60">{essayMeta(post)}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
        {posts.length > 0 && matching.length === 0 ? (
          <p className="mt-8 text-sm text-[#203337]/70">No published essay matches that search.</p>
        ) : null}
        <p className="mt-10 text-sm">
          <Link href="/blog/feed.xml" className="font-semibold text-primary">RSS</Link>
          <span className="text-[#203337]/50"> · </span>
          <Link href="/offer" className="font-semibold text-primary">The offer</Link>
        </p>
      </section>
    </main>
  );
}
