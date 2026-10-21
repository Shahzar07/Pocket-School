/** SEO, answers, and custom fields stored beside the essay. */

import type { BlogPost } from '@/lib/blog/posts';

const ORIGIN = 'https://poketschool.ai';

function coverPath(value: string): boolean {
  if (value.startsWith('https://')) return true;
  if (/^http:\/\/(127\.0\.0\.1|localhost):9199\//.test(value)) return true;
  return value.startsWith('/blog/') && !value.includes('..') && value.endsWith('.webp');
}

export type CustomFieldKind = 'text' | 'url' | 'number' | 'date' | 'toggle';

export interface BlogCustomField {
  key: string;
  kind: CustomFieldKind;
  value: string;
}

export interface BlogHowToStep {
  name: string;
  text: string;
}

export interface BlogSeoFields {
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: 'summary' | 'summary_large_image';
  tldr: string;
  takeaways: string[];
  howto: BlogHowToStep[];
  targetQuestions: string[];
  entities: string[];
  reviewedAt: number | null;
  reviewer: string;
  customFields: BlogCustomField[];
}

export const EMPTY_SEO: BlogSeoFields = {
  seoTitle: '',
  seoDescription: '',
  canonical: '',
  focusKeyword: '',
  secondaryKeywords: [],
  robotsIndex: true,
  robotsFollow: true,
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  twitterCard: 'summary_large_image',
  tldr: '',
  takeaways: [],
  howto: [],
  targetQuestions: [],
  entities: [],
  reviewedAt: null,
  reviewer: '',
  customFields: [],
};

const KINDS = new Set<CustomFieldKind>(['text', 'url', 'number', 'date', 'toggle']);

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function lines(value: unknown, max: number, each: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, each))
    .slice(0, max);
}

export function parseSeoFields(raw: Record<string, unknown>): BlogSeoFields {
  const howto = Array.isArray(raw.howto)
    ? raw.howto.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const name = text(row.name, 120);
      const step = text(row.text, 400);
      return name && step ? [{ name, text: step }] : [];
    }).slice(0, 12)
    : [];
  const customFields = Array.isArray(raw.customFields)
    ? raw.customFields.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const key = text(row.key, 40).replace(/[^a-z0-9_-]/gi, '');
      const kind = typeof row.kind === 'string' && KINDS.has(row.kind as CustomFieldKind) ? row.kind as CustomFieldKind : 'text';
      const value = text(row.value, 300);
      return key ? [{ key, kind, value }] : [];
    }).slice(0, 24)
    : [];
  const card = raw.twitterCard === 'summary' ? 'summary' : 'summary_large_image';
  const canonical = text(raw.canonical, 300);
  const safeCanonical = canonical.startsWith('/') || canonical.startsWith('https://poketschool.ai/') ? canonical : '';
  const ogImage = text(raw.ogImage, 500);
  return {
    seoTitle: text(raw.seoTitle, 70),
    seoDescription: text(raw.seoDescription, 180),
    canonical: safeCanonical,
    focusKeyword: text(raw.focusKeyword, 80),
    secondaryKeywords: lines(raw.secondaryKeywords, 8, 40),
    robotsIndex: raw.robotsIndex !== false,
    robotsFollow: raw.robotsFollow !== false,
    ogTitle: text(raw.ogTitle, 70),
    ogDescription: text(raw.ogDescription, 200),
    ogImage: coverPath(ogImage) ? ogImage : '',
    twitterCard: card,
    tldr: text(raw.tldr, 400),
    takeaways: lines(raw.takeaways, 8, 180),
    howto,
    targetQuestions: lines(raw.targetQuestions, 8, 160),
    entities: lines(raw.entities, 12, 60),
    reviewedAt: typeof raw.reviewedAt === 'number' && Number.isFinite(raw.reviewedAt) ? raw.reviewedAt : null,
    reviewer: text(raw.reviewer, 80),
    customFields,
  };
}

export function withSeo(post: BlogPost): BlogPost & BlogSeoFields {
  return { ...EMPTY_SEO, ...post, ...parseSeoFields(post as unknown as Record<string, unknown>) };
}

export function seoTitle(post: BlogPost): string {
  return (post.seoTitle || post.title).trim();
}

export function seoDescription(post: BlogPost): string {
  return (post.seoDescription || post.excerpt).trim();
}

export function allowIndex(post: BlogPost): boolean {
  return post.robotsIndex !== false;
}

export function seoScore(post: BlogPost): { score: number; checks: { id: string; label: string; ok: boolean }[] } {
  const title = seoTitle(post);
  const description = seoDescription(post);
  const keyword = (post.focusKeyword || '').trim().toLowerCase();
  const checks = [
    { id: 'title', label: 'SEO title is 30 to 60 characters', ok: title.length >= 30 && title.length <= 60 },
    { id: 'description', label: 'Meta description is 70 to 160 characters', ok: description.length >= 70 && description.length <= 160 },
    { id: 'slug', label: 'Slug is set', ok: post.slug.trim().length > 2 },
    { id: 'keyword', label: 'Focus keyword appears in the title or essay', ok: !keyword || `${post.title}\n${post.body}`.toLowerCase().includes(keyword) },
    { id: 'alt', label: 'Banner has a description', ok: !post.coverImage || (post.coverAlt || '').trim().length >= 2 },
    { id: 'tldr', label: 'Direct answer is filled', ok: (post.tldr || '').trim().length >= 40 },
    { id: 'faq', label: 'At least one question and answer', ok: post.faq.some((item) => item.question.trim() && item.answer.trim()) },
    { id: 'takeaways', label: 'Key takeaways are filled', ok: (post.takeaways || []).some((item) => item.trim().length > 0) },
  ];
  const passed = checks.filter((item) => item.ok).length;
  return { score: Math.round((passed / checks.length) * 100), checks };
}

export function breadcrumbJsonLd(post: BlogPost): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Poket School', item: ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${ORIGIN}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${ORIGIN}/blog/${post.slug}` },
    ],
  };
}

export function howtoJsonLd(post: BlogPost): Record<string, unknown> | null {
  const steps = (post.howto || []).filter((step) => step.name.trim() && step.text.trim());
  if (!steps.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: post.title,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

function absolute(value: string): string {
  if (value.startsWith('/blog/')) return `${ORIGIN}${value}`;
  return value;
}

/** BlogPosting for the public essay. Omitted when the editor turns indexing off. */
export function postingJsonLd(post: BlogPost): Record<string, unknown> {
  const image = coverPath(post.ogImage || '')
    ? absolute(post.ogImage || '')
    : coverPath(post.coverImage)
      ? absolute(post.coverImage)
      : '';
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: seoTitle(post),
    description: seoDescription(post),
    dateModified: new Date(post.updatedAt || Date.now()).toISOString(),
    author: { '@type': 'Person', name: post.author || 'Poket School' },
    publisher: { '@type': 'Organization', name: 'Poket School', url: ORIGIN },
    mainEntityOfPage: `${ORIGIN}/blog/${post.slug}`,
  };
  if (post.publishedAt) data.datePublished = new Date(post.publishedAt).toISOString();
  if (image) data.image = [image];
  if (post.reviewer) data.reviewedBy = { '@type': 'Person', name: post.reviewer };
  if (post.reviewedAt) data.lastReviewed = new Date(post.reviewedAt).toISOString();
  return data;
}

export function jsonLdForPost(post: BlogPost): Record<string, unknown>[] {
  if (!allowIndex(post)) return [];
  const blocks = [postingJsonLd(post), breadcrumbJsonLd(post)];
  const faqs = post.faq.filter((item) => item.question.trim() && item.answer.trim());
  if (faqs.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });
  }
  const howto = howtoJsonLd(post);
  if (howto) blocks.push(howto);
  return blocks;
}

/** A suggestion drawn only from the essay. No invented figures. */
export function localSeoSuggestion(post: Pick<BlogPost, 'title' | 'excerpt' | 'body'>): Partial<BlogSeoFields> {
  const sentences = post.body
    .replace(/[#>*_`~+|]/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 40 && !/\d{2,}%/.test(part));
  const tldr = (post.excerpt.trim() || sentences[0] || post.title).slice(0, 400);
  const takeaways = sentences.slice(0, 3).map((line) => line.slice(0, 180));
  return {
    seoTitle: post.title.trim().slice(0, 60),
    seoDescription: (post.excerpt.trim() || tldr).slice(0, 160),
    tldr,
    takeaways,
  };
}
