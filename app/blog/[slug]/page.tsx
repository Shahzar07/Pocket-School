import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AffiliateNote, ArticleBody, ArticleCta, Cover } from '@/components/blog/article';
import { publishedPost, publishedPosts } from '@/lib/blog/load';
import { absoluteCover, articleJsonLd, faqJsonLd, isCoverPath, jsonLdScript } from '@/lib/blog/posts';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const posts = await publishedPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await publishedPost(slug);
  if (!post) return { title: 'Essay not found', robots: { index: false, follow: false } };
  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author }],
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      url: `/blog/${post.slug}`,
      title: post.title,
      description: post.excerpt,
      siteName: 'Poket School',
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
      authors: [post.author],
      tags: post.tags,
      images: isCoverPath(post.coverImage) ? [{ url: absoluteCover(post.coverImage) }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await publishedPost(slug);
  if (!post) notFound();
  const faq = faqJsonLd(post);
  const when = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <main id="content" className="min-h-screen bg-[#F8F4EE] text-[#203337]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd(post)) }} />
      {faq ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faq) }} /> : null}
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
        <p className="text-xs font-bold tracking-[0.18em] text-primary">
          <Link href="/blog">Blog</Link>
          <span> · {post.category}</span>
        </p>
        <h1 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">{post.title}</h1>
        <p className="mt-4 text-sm text-[#203337]/65">
          {post.author}
          {when ? ` · ${when}` : ''}
        </p>
        <AffiliateNote post={post} />
        <Cover post={post} className="mt-6 h-64 rounded-[2rem] sm:h-80" />
        <p className="mt-8 text-lg leading-8 text-[#203337]/80">{post.excerpt}</p>
        <div className="mt-6">
          <ArticleBody post={post} />
        </div>
        {post.tags.length > 0 ? (
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
            {post.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{tag}</li>
            ))}
          </ul>
        ) : null}
        {post.faq.length > 0 ? (
          <section className="mt-10" aria-labelledby="essay-faq">
            <h2 id="essay-faq" className="font-heading text-2xl">Questions</h2>
            <dl className="mt-4 space-y-4">
              {post.faq.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold">{item.question}</dt>
                  <dd className="mt-1 text-[#203337]/75">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <ArticleCta post={post} />
      </article>
    </main>
  );
}
