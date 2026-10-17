import Link from 'next/link';
import type { BlogPost } from '@/lib/blog/posts';

function blocks(body: string): string[] {
  return body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

export function ArticleBody({ post }: { post: BlogPost }) {
  return (
    <div className="space-y-5 text-[17px] leading-8 text-[#203337]">
      {blocks(post.body).map((part) => <p key={part.slice(0, 48)}>{part}</p>)}
    </div>
  );
}

export function ArticleCta({ post }: { post: BlogPost }) {
  return (
    <aside className="mt-10 rounded-3xl bg-[#203337] px-6 py-7 text-white sm:px-8">
      <h2 className="font-heading text-2xl tracking-tight">{post.ctaTitle}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">{post.ctaBody}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/offer" className="inline-flex min-h-11 items-center rounded-full bg-[#E2AF4D] px-5 text-sm font-bold text-[#203337]">
          See the offer
        </Link>
        <Link href="/signup" className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-5 text-sm font-bold">
          Create an account
        </Link>
      </div>
    </aside>
  );
}

export function Cover({ post, className = '' }: { post: BlogPost; className?: string }) {
  if (post.coverImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.coverImage} alt="" className={`w-full object-cover ${className}`} />
    );
  }
  return (
    <div className={`bg-gradient-to-br from-[#2786A4] via-[#1E3A8A] to-[#203337] ${className}`} aria-hidden />
  );
}
