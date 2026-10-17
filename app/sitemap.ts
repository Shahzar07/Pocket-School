import type { MetadataRoute } from 'next';
import { publishedPosts } from '@/lib/blog/load';

const BASE_URL = 'https://poketschool.ai';

const ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/courses', changeFrequency: 'daily', priority: 0.9 },
  { path: '/reads', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/ai-studio', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/ai-teachers', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/blog', changeFrequency: 'daily', priority: 0.7 },
  { path: '/offer', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/legal', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/login', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/signup', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/stand-up-to-bullying', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/safety-terms', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/community-partners', changeFrequency: 'monthly', priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const posts = await publishedPosts();

  return [
    ...ROUTES.map(({ path, changeFrequency, priority }) => ({
      url: `${BASE_URL}${path}`,
      lastModified,
      changeFrequency,
      priority,
    })),
    ...posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
