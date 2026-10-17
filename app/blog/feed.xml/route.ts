import { publishedPosts } from '@/lib/blog/load';
import { renderRss } from '@/lib/blog/posts';

export const revalidate = 3600;

export async function GET() {
  const posts = await publishedPosts();
  return new Response(renderRss(posts), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
