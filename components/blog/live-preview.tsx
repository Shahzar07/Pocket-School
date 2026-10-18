import { ArticleBody, Cover } from '@/components/blog/article';
import type { BlogPost } from '@/lib/blog/posts';

export function BlogLivePreview({ post }: { post: BlogPost }) {
  return (
    <article className="rounded-[2rem] bg-[#F8F4EE] p-4 text-[#203337] sm:p-6" aria-label="Live preview">
      <p className="text-xs font-bold tracking-[0.18em] text-[#1E6A83]">Live preview · {post.status}</p>
      <h2 className="mt-2 font-heading text-3xl tracking-tight">{post.title || 'Untitled essay'}</h2>
      <p className="mt-2 text-sm text-[#203337]/70">{post.author || 'Poket School'} · {post.category}</p>
      <Cover post={post} className="mt-4 h-40 rounded-3xl" />
      {post.excerpt ? <p className="mt-4 text-base leading-7">{post.excerpt}</p> : null}
      <div className="mt-4">
        <ArticleBody post={post} />
      </div>
      {post.faq.some((item) => item.question.trim()) ? (
        <section className="mt-6">
          <h3 className="font-heading text-xl">Questions</h3>
          <ul className="mt-2 space-y-2">
            {post.faq.filter((item) => item.question.trim()).map((item) => (
              <li key={item.question}>
                <p className="font-semibold">{item.question}</p>
                <p className="text-sm">{item.answer}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
