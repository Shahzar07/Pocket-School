import { ArticleBody, ArticleCta, PostHero } from '@/components/blog/article';
import { readingMinutes } from '@/lib/blog/posts';
import type { BlogPost } from '@/lib/blog/posts';

/** The public essay, at a readable width, on the journal background. */
export function BlogLivePreview({ post }: { post: BlogPost }) {
  const takeaways = (post.takeaways || []).map((item) => item.trim()).filter(Boolean);
  const steps = (post.howto || []).filter((step) => step.name.trim() && step.text.trim());
  return (
    <div data-blog-preview="1" className="rounded-[2rem] bg-[#F8F4EE] text-[#203337]">
      <p className="px-4 pt-4 text-xs font-bold tracking-[0.18em] text-[#1E6A83] sm:px-6">Live preview · {post.status}</p>
      <div className="mt-4">
        <PostHero post={post} />
      </div>
      <article className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-6">
        <p className="text-sm text-[#203337]/70">
          {post.author || 'Poket School'}
          {` · ${readingMinutes(post.body)} min read`}
        </p>
        {post.tldr ? <p className="mt-4 text-lg leading-8" data-blog-tldr="1">{post.tldr}</p> : null}
        {post.excerpt ? <p className="mt-4 text-base leading-7 text-[#203337]/80">{post.excerpt}</p> : null}
        {takeaways.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-heading text-xl">Key takeaways</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {takeaways.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}
        <div className="mt-6">
          <ArticleBody post={post} />
        </div>
        {steps.length > 0 ? (
          <section className="mt-6">
            <h2 className="font-heading text-xl">Steps</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {steps.map((step) => (
                <li key={step.name}>
                  <span className="font-semibold">{step.name}. </span>
                  {step.text}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {post.faq.some((item) => item.question.trim()) ? (
          <section className="mt-6">
            <h2 className="font-heading text-xl">Questions</h2>
            <dl className="mt-2 space-y-2">
              {post.faq.filter((item) => item.question.trim()).map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold">{item.question}</dt>
                  <dd>{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <ArticleCta post={post} />
      </article>
    </div>
  );
}
