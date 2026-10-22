import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AffiliateNote, ArticleBody, ArticleCta, PostHero } from '@/components/blog/article';
import { publishedPost, publishedPosts } from '@/lib/blog/load';
import { BLOG_PUBLIC } from '@/lib/blog/public-copy';
import { absoluteCover, coverAltOf, isCoverPath, jsonLdScript, readingMinutes } from '@/lib/blog/posts';
import { allowIndex, jsonLdForPost, seoDescription, seoTitle } from '@/lib/blog/seo';

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
  const imageSource = isCoverPath(post.ogImage || '') ? post.ogImage || '' : post.coverImage;
  const image = isCoverPath(imageSource)
    ? [{ url: absoluteCover(imageSource), width: 1600, height: 900, alt: coverAltOf(post) }]
    : undefined;
  const canonical = post.canonical && (post.canonical.startsWith('/') || post.canonical.startsWith('https://poketschool.ai/'))
    ? post.canonical
    : `/blog/${post.slug}`;
  return {
    title: seoTitle(post),
    description: seoDescription(post),
    authors: [{ name: post.author }],
    robots: allowIndex(post)
      ? { index: true, follow: post.robotsFollow !== false }
      : { index: false, follow: post.robotsFollow !== false },
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: `/blog/${post.slug}`,
      title: post.ogTitle || seoTitle(post),
      description: post.ogDescription || seoDescription(post),
      siteName: 'Poket School',
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
      authors: [post.author],
      tags: post.tags,
      ...(image ? { images: image } : {}),
    },
    twitter: {
      card: post.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
      title: post.ogTitle || seoTitle(post),
      description: post.ogDescription || seoDescription(post),
      ...(image ? { images: image.map((item) => item.url) } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await publishedPost(slug);
  if (!post) notFound();
  const when = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const blocks = jsonLdForPost(post);
  const takeaways = (post.takeaways || []).map((item) => item.trim()).filter(Boolean);
  const steps = (post.howto || []).filter((step) => step.name.trim() && step.text.trim());

  return (
    <main id="content" className="min-h-screen bg-background text-foreground" data-theme-surface="page">
      {blocks.map((block, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(block) }} />
      ))}
      <PostHero post={post} />
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <p className="text-xs font-bold tracking-[0.18em] text-primary">
          <Link href="/blog">Blog</Link>
          <span> · {post.category}</span>
        </p>
        <p className="mt-4 text-sm text-foreground/65">
          {post.author}
          {when ? ` · ${when}` : ''}
          {` · ${readingMinutes(post.body)} ${BLOG_PUBLIC.minRead}`}
        </p>
        <AffiliateNote post={post} />
        {post.tldr ? <p className="mt-8 text-lg leading-8" data-blog-tldr="1">{post.tldr}</p> : null}
        <p className="mt-8 text-lg leading-8 text-foreground/80">{post.excerpt}</p>
        {takeaways.length > 0 ? (
          <section className="mt-8" aria-labelledby="essay-takeaways">
            <h2 id="essay-takeaways" className="font-heading text-2xl">Key takeaways</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {takeaways.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}
        <div className="mt-6">
          <ArticleBody post={post} />
        </div>
        {post.tags.length > 0 ? (
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
            {post.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-card-foreground">{tag}</li>
            ))}
          </ul>
        ) : null}
        {steps.length > 0 ? (
          <section className="mt-10" aria-labelledby="essay-steps">
            <h2 id="essay-steps" className="font-heading text-2xl">Steps</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              {steps.map((step) => (
                <li key={step.name}>
                  <span className="font-semibold">{step.name}. </span>
                  {step.text}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {post.faq.length > 0 ? (
          <section className="mt-10" aria-labelledby="essay-faq">
            <h2 id="essay-faq" className="font-heading text-2xl">Questions</h2>
            <dl className="mt-4 space-y-4">
              {post.faq.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold">{item.question}</dt>
                  <dd className="mt-1 text-foreground/75">{item.answer}</dd>
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
