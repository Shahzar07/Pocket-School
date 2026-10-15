const SITE = 'https://poketschool.ai';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Poket School',
        legalName: 'Poket Media Sdn Bhd',
        url: SITE,
      },
      {
        '@type': 'WebSite',
        name: 'Poket School',
        url: SITE,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE}/courses?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

export function courseJsonLd(course: {
  id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description || undefined,
    url: `${SITE}/courses/${course.id}`,
    provider: {
      '@type': 'Organization',
      name: 'Poket School',
      sameAs: SITE,
    },
    ...(course.price && course.price > 0
      ? {
          offers: {
            '@type': 'Offer',
            price: course.price,
            priceCurrency: (course.currency ?? 'USD').toUpperCase(),
            url: `${SITE}/courses/${course.id}`,
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
