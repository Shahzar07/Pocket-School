/** Marketing journal. Repo drafts never appear on the public site. */
import { DRAFT_POSTS } from './drafts';

export type BlogStatus = 'draft' | 'scheduled' | 'published';

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogLink {
  label: string;
  href: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  author: string;
  coverImage: string;
  featured: boolean;
  status: BlogStatus;
  publishedAt: number | null;
  updatedAt: number;
  ctaTitle: string;
  ctaBody: string;
  ctaLinks: BlogLink[];
  faq: BlogFaq[];
  /** Book reviews keep Shopee placeholders until a real link is pasted in. */
  affiliate: boolean;
  /** Repo drafts. They stay off the public site until a super admin saves a published copy. */
  sample: boolean;
}

export const BLOG_CATEGORIES = ['Learning', 'ET AI', 'Families', 'Schools', 'Book Reviews'] as const;

export const AFFILIATE_DISCLOSURE = 'This post contains affiliate links. If you buy through them, Poket School may earn a small commission at no extra cost to you. We only review books we think are genuinely useful to learners and families.';

export const AFFILIATE_REL = 'sponsored nofollow';

const AFFILIATE_TOKEN = /^\[SHOPEE_AFFILIATE_LINK:\s*([^\]]+)\]$/;

export function isAffiliateToken(value: string): boolean {
  return AFFILIATE_TOKEN.test(value.trim());
}

/** Local covers live in public/blog. Remote covers stay on https. */
export function isCoverPath(value: string): boolean {
  if (value.startsWith('https://')) return true;
  return value.startsWith('/blog/') && !value.includes('..') && value.endsWith('.webp');
}

export function absoluteCover(value: string): string {
  if (value.startsWith('/blog/')) return `${BLOG_ORIGIN}${value}`;
  return value;
}

export const BLOG_ORIGIN = 'https://poketschool.ai';

const SAMPLE_CTA = {
  ctaTitle: 'See how Poket School fits',
  ctaBody: 'Read the offer, then open an account. ET AI stays with the learner from the first lesson.',
};

/** Unpublished drafts shipped with the site. Public pages ignore them until published. */
export const SAMPLE_POSTS: BlogPost[] = DRAFT_POSTS;

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** A sample draft is never public. A scheduled essay stays hidden until its time. */
export function isPublic(post: BlogPost, now: number): boolean {
  if (post.sample || post.status === 'draft') return false;
  if (post.status === 'scheduled') return post.publishedAt != null && post.publishedAt <= now;
  if (post.status !== 'published') return false;
  return post.publishedAt == null || post.publishedAt <= now;
}

export function filterPosts(posts: readonly BlogPost[], query: string, category: string): BlogPost[] {
  const needle = query.trim().toLowerCase();
  return posts.filter((post) => {
    if (category && category !== 'All' && post.category !== category) return false;
    if (!needle) return true;
    const haystack = [post.title, post.excerpt, post.body, post.author, post.category, ...post.tags]
      .join('\n')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function featuredPost(posts: readonly BlogPost[]): BlogPost | null {
  const ranked = posts.slice().sort((a, b) => (b.publishedAt ?? b.updatedAt) - (a.publishedAt ?? a.updatedAt));
  return ranked.find((post) => post.featured) ?? ranked[0] ?? null;
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderRss(posts: readonly BlogPost[]): string {
  const items = posts.map((post) => {
    const link = `${BLOG_ORIGIN}/blog/${post.slug}`;
    const when = new Date(post.publishedAt ?? post.updatedAt).toUTCString();
    return [
      '<item>',
      `<title>${xmlEscape(post.title)}</title>`,
      `<link>${link}</link>`,
      `<guid>${link}</guid>`,
      `<pubDate>${when}</pubDate>`,
      `<description>${xmlEscape(post.excerpt)}</description>`,
      `<category>${xmlEscape(post.category)}</category>`,
      '</item>',
    ].join('');
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0"><channel>` +
    `<title>${xmlEscape('Poket School Blog')}</title>` +
    `<link>${BLOG_ORIGIN}/blog</link>` +
    `<description>${xmlEscape('Essays from Poket School and ET AI.')}</description>` +
    items +
    `</channel></rss>`;
}

export function articleJsonLd(post: BlogPost): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'Poket School',
      url: BLOG_ORIGIN,
    },
    mainEntityOfPage: `${BLOG_ORIGIN}/blog/${post.slug}`,
  };
  if (post.publishedAt) data.datePublished = new Date(post.publishedAt).toISOString();
  if (isCoverPath(post.coverImage)) data.image = [absoluteCover(post.coverImage)];
  return data;
}

export function faqJsonLd(post: BlogPost): Record<string, unknown> | null {
  const faqs = post.faq.filter((item) => item.question.trim() && item.answer.trim());
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

const STATUSES = new Set<BlogStatus>(['draft', 'scheduled', 'published']);

export function parseStoredPost(slug: string, raw: unknown): BlogPost | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const body = typeof data.body === 'string' ? data.body : '';
  if (!title || !body.trim()) return null;
  const status = typeof data.status === 'string' && STATUSES.has(data.status as BlogStatus)
    ? data.status as BlogStatus
    : 'draft';
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag) => tag.trim()).slice(0, 12)
    : [];
  const faq = Array.isArray(data.faq)
    ? data.faq.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const question = typeof row.question === 'string' ? row.question.trim() : '';
      const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
      return question && answer ? [{ question, answer }] : [];
    }).slice(0, 8)
    : [];
  const publishedAt = typeof data.publishedAt === 'number' && Number.isFinite(data.publishedAt) ? data.publishedAt : null;
  const category = (typeof data.category === 'string' && data.category.trim() ? data.category : 'Learning').slice(0, 40);
  const ctaLinks = Array.isArray(data.ctaLinks)
    ? data.ctaLinks.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const label = typeof row.label === 'string' ? row.label.trim() : '';
      const href = typeof row.href === 'string' ? row.href.trim() : '';
      if (!label || !href) return [];
      if (!(href.startsWith('/') || href.startsWith('mailto:') || href.startsWith('https://') || isAffiliateToken(href))) return [];
      return [{ label: label.slice(0, 80), href: href.slice(0, 300) }];
    }).slice(0, 6)
    : [];
  const coverImage = typeof data.coverImage === 'string' && isCoverPath(data.coverImage) ? data.coverImage.slice(0, 500) : '';
  return {
    slug: slugify(typeof data.slug === 'string' && data.slug.trim() ? data.slug : slug) || slug,
    title: title.slice(0, 180),
    excerpt: (typeof data.excerpt === 'string' ? data.excerpt : '').slice(0, 300),
    body: body.slice(0, 28000),
    category,
    tags,
    author: (typeof data.author === 'string' && data.author.trim() ? data.author : 'Poket School').slice(0, 80),
    coverImage,
    featured: data.featured === true,
    status,
    publishedAt,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    ctaTitle: (typeof data.ctaTitle === 'string' && data.ctaTitle.trim() ? data.ctaTitle : SAMPLE_CTA.ctaTitle).slice(0, 120),
    ctaBody: (typeof data.ctaBody === 'string' && data.ctaBody.trim() ? data.ctaBody : SAMPLE_CTA.ctaBody).slice(0, 400),
    ctaLinks,
    faq,
    affiliate: data.affiliate === true || category === 'Book Reviews',
    sample: false,
  };
}
