import 'server-only';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { SAMPLE_POSTS, isPublic, parseStoredPost, type BlogPost } from '@/lib/blog/posts';

/** Repo drafts plus anything a super admin has saved. A missing admin SDK keeps the drafts only. */
export async function loadBlogPosts(): Promise<BlogPost[]> {
  const posts = SAMPLE_POSTS.map((post) => ({ ...post, faq: post.faq.map((item) => ({ ...item })) }));
  if (!isAdminConfigured()) return posts;
  try {
    const snap = await adminDb().collection('blogPosts').get();
    snap.forEach((doc) => {
      const parsed = parseStoredPost(doc.id, doc.data());
      if (!parsed) return;
      const index = posts.findIndex((post) => post.slug === parsed.slug);
      if (index >= 0 && posts[index]?.sample) posts[index] = parsed;
      else if (index < 0) posts.push(parsed);
    });
  } catch (error) {
    console.error('[blog] read', error);
  }
  return posts;
}

export async function publishedPosts(now = Date.now()): Promise<BlogPost[]> {
  const posts = await loadBlogPosts();
  return posts.filter((post) => isPublic(post, now));
}

export async function publishedPost(slug: string, now = Date.now()): Promise<BlogPost | null> {
  const posts = await publishedPosts(now);
  return posts.find((post) => post.slug === slug) ?? null;
}
