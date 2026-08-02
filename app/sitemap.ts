import type { MetadataRoute } from 'next';

const BASE_URL = 'https://poketschool.ai';

const ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/courses', changeFrequency: 'daily', priority: 0.9 },
  { path: '/ai-studio', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/ai-teachers', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/legal', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/login', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/signup', changeFrequency: 'yearly', priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
