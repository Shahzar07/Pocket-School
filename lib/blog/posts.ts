/** Marketing journal. Draft samples never appear on the public site. */

export type BlogStatus = 'draft' | 'scheduled' | 'published';

export interface BlogFaq {
  question: string;
  answer: string;
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
  faq: BlogFaq[];
  /** Repo samples. They stay off the public site even if a status is edited by mistake. */
  sample: boolean;
}

export const BLOG_CATEGORIES = ['Learning', 'ET AI', 'Families', 'Schools'] as const;

export const BLOG_ORIGIN = 'https://poketschool.ai';

const SAMPLE_CTA = {
  ctaTitle: 'See how Poket School fits',
  ctaBody: 'Read the offer, then open an account. ET AI stays with the learner from the first lesson.',
};

export const SAMPLE_POSTS: BlogPost[] = [
  {
    slug: 'sample-how-et-ai-studies-with-you',
    title: 'Sample draft: How ET AI studies with you',
    excerpt: 'Unpublished sample. A short look at a one-to-one lesson with ET AI.',
    body: [
      'This is a sample draft. It is not published.',
      'ET AI sits with one learner at a time. A Primary lesson can be a short explanation and a question. A Secondary lesson can slow down on the step that slipped. IGCSE and A-Level lessons keep the wording of the specification and the habit of showing working.',
      'The teacher on the screen is ET AI. Poket School is the school around that conversation: lessons, practice, and a record of what has been learned.',
    ].join('\n\n'),
    category: 'ET AI',
    tags: ['ET AI', 'lessons'],
    author: 'Poket School',
    coverImage: '',
    featured: true,
    status: 'draft',
    publishedAt: null,
    updatedAt: 1760572800000,
    ...SAMPLE_CTA,
    faq: [
      {
        question: 'Who is the tutor in a Poket School lesson?',
        answer: 'ET AI. The name on the screen is always ET AI, or ET followed by the subject, such as ET Maths.',
      },
      {
        question: 'Which pathways does this sample mention?',
        answer: 'Primary, Secondary, IGCSE, and A-Level. It does not use numbered year groups.',
      },
    ],
    sample: true,
  },
  {
    slug: 'sample-a-week-that-stays',
    title: 'Sample draft: A week of lessons that stay',
    excerpt: 'Unpublished sample. How a family can keep a short daily rhythm.',
    body: [
      'This is a sample draft. It is not published.',
      'A useful week is small. One lesson, a few questions, and a note of what still feels shaky. Families can see that rhythm without sitting the lesson themselves.',
      'Poket School keeps the lesson in the learner’s language of study and the record in one place, so the next session starts where the last one stopped.',
    ].join('\n\n'),
    category: 'Families',
    tags: ['families', 'practice'],
    author: 'Poket School',
    coverImage: '',
    featured: false,
    status: 'draft',
    publishedAt: null,
    updatedAt: 1760486400000,
    ...SAMPLE_CTA,
    faq: [
      {
        question: 'Is this essay live on the site?',
        answer: 'No. It is a labelled sample draft for the editorial desk.',
      },
    ],
    sample: true,
  },
  {
    slug: 'sample-what-schools-hand-to-et-ai',
    title: 'Sample draft: What a school can hand to ET AI',
    excerpt: 'Unpublished sample. Notes, topics, and the line between the school and the tutor.',
    body: [
      'This is a sample draft. It is not published.',
      'A school can hand ET AI the topic, the level, and the kind of practice it wants. Primary, Secondary, IGCSE, and A-Level stay named that way, so a department can see the pathway without a numbered year label.',
      'Poket School does not replace the school’s own teachers. ET AI is the extra conversation between lessons.',
    ].join('\n\n'),
    category: 'Schools',
    tags: ['schools', 'ET AI'],
    author: 'Poket School',
    coverImage: '',
    featured: false,
    status: 'draft',
    publishedAt: null,
    updatedAt: 1760400000000,
    ...SAMPLE_CTA,
    faq: [
      {
        question: 'Does ET AI replace a school’s teachers?',
        answer: 'No. ET AI is the extra one-to-one conversation. The school keeps its own teachers.',
      },
    ],
    sample: true,
  },
];

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
  if (post.coverImage.startsWith('https://')) data.image = [post.coverImage];
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
  return {
    slug: slugify(typeof data.slug === 'string' && data.slug.trim() ? data.slug : slug) || slug,
    title: title.slice(0, 180),
    excerpt: (typeof data.excerpt === 'string' ? data.excerpt : '').slice(0, 300),
    body: body.slice(0, 20000),
    category: (typeof data.category === 'string' && data.category.trim() ? data.category : 'Learning').slice(0, 40),
    tags,
    author: (typeof data.author === 'string' && data.author.trim() ? data.author : 'Poket School').slice(0, 80),
    coverImage: typeof data.coverImage === 'string' && data.coverImage.startsWith('https://') ? data.coverImage.slice(0, 500) : '',
    featured: data.featured === true,
    status,
    publishedAt,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    ctaTitle: (typeof data.ctaTitle === 'string' && data.ctaTitle.trim() ? data.ctaTitle : SAMPLE_CTA.ctaTitle).slice(0, 120),
    ctaBody: (typeof data.ctaBody === 'string' && data.ctaBody.trim() ? data.ctaBody : SAMPLE_CTA.ctaBody).slice(0, 300),
    faq,
    sample: false,
  };
}
