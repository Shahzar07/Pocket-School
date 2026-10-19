import { ImageResponse } from 'next/og';
import { blogOgCard } from '@/lib/blog/og-card';
import { publishedPost } from '@/lib/blog/load';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Poket School essay';

export default async function BlogOpenGraph({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await publishedPost(slug).catch(() => null);
  return new ImageResponse(blogOgCard(post?.title || 'Poket School'), { ...size });
}
