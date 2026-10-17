import { LEGAL_COMPANY_NO, LEGAL_ENTITY } from './legal';
import { LANGUAGES } from './languages';
import { READS_BOOKS, READS_PLANS } from './payments/reads';

/** Public sales letter. Separate from the Poket School plan ladder at /offer. */
export const READS_OFFER_PATH = '/reads/offer';
export const READS_OFFER_URL = `https://poketschool.ai${READS_OFFER_PATH}`;

/** Interface languages. A book is translated one title at a time, not all at once. */
export const READS_OFFER_LANGUAGE_COUNT = LANGUAGES.length;

export const READS_OFFER_ENTITY = LEGAL_ENTITY;
export const READS_OFFER_COMPANY_NO = LEGAL_COMPANY_NO;

const PLAN_USD = Object.fromEntries(READS_PLANS.map(plan => [plan.id, plan.usd])) as Record<string, number>;

export function readsMonthlyUsd(sku: 'reads' | 'reads-family'): number {
  const usd = PLAN_USD[sku];
  if (!usd) throw new Error(`Unknown Reads plan ${sku}`);
  return usd;
}

/** Annual Reads is ten times the monthly price. Two months are not billed. */
export function readsYearlyUsd(sku: 'reads' | 'reads-family'): number {
  return readsMonthlyUsd(sku) * 10;
}

export function readsCheckoutHref(sku: 'reads' | 'reads-family', interval: 'month' | 'year'): string {
  const params = new URLSearchParams({ kind: 'reads', sku, interval });
  return `/dashboard/checkout?${params.toString()}`;
}

export function bookCheckoutHref(sku: string): string {
  const params = new URLSearchParams({ kind: 'book', sku });
  return `/dashboard/checkout?${params.toString()}`;
}

export interface OfferCheckout {
  id: string;
  sku: 'reads' | 'reads-family';
  interval: 'month' | 'year';
  usd: number;
  name: string;
  cadence: string;
  audience: string;
  detail: string;
  cta: string;
  badge?: string;
}

export const READS_OFFER_CHECKOUTS: OfferCheckout[] = [
  {
    id: 'reads-month',
    sku: 'reads',
    interval: 'month',
    usd: readsMonthlyUsd('reads'),
    name: 'Poket Reads',
    cadence: 'a month',
    audience: 'One reader',
    detail: 'The Primary, Lower Secondary and general shelf, including children’s stories.',
    cta: 'Subscribe monthly',
  },
  {
    id: 'reads-year',
    sku: 'reads',
    interval: 'year',
    usd: readsYearlyUsd('reads'),
    name: 'Poket Reads',
    cadence: 'a year',
    audience: 'One reader',
    detail: 'The same shelf. The yearly price is ten months, so two months are not billed.',
    cta: 'Subscribe yearly',
    badge: 'Two months not billed',
  },
  {
    id: 'reads-family-month',
    sku: 'reads-family',
    interval: 'month',
    usd: readsMonthlyUsd('reads-family'),
    name: 'Reads Family',
    cadence: 'a month',
    audience: 'A household',
    detail: 'More than one profile. A child’s profile only shows books that fit their age.',
    cta: 'Start Family monthly',
  },
  {
    id: 'reads-family-year',
    sku: 'reads-family',
    interval: 'year',
    usd: readsYearlyUsd('reads-family'),
    name: 'Reads Family',
    cadence: 'a year',
    audience: 'A household',
    detail: 'The household shelf for the year. Same ten-month price, same age filters.',
    cta: 'Start Family yearly',
    badge: 'Two months not billed',
  },
];

export interface ShelfBookPrice {
  id: string;
  title: string;
  usd: number;
}

export const READS_OFFER_BOOKS: ShelfBookPrice[] = READS_BOOKS.map(book => ({
  id: book.id,
  title: book.title,
  usd: book.usd,
}));

export interface OfferFaq {
  question: string;
  answer: string;
}

export const READS_OFFER_FAQ: OfferFaq[] = [
  {
    question: 'Is Poket Reads only included with Poket School?',
    answer: 'No. This page sells Poket Reads on its own. Poket School plans use a different checkout. You can subscribe to Reads, or buy a single book, without taking a school plan.',
  },
  {
    question: 'Why mention Kindle Unlimited and Amazon Kids+?',
    answer: 'Neither service is sold in Malaysia. Poket Reads is a shelf you can pay for from here. Checkout can take a card, FPX, GrabPay, Touch \'n Go, Boost, ShopeePay or DuitNow when that method is offered for your country and currency.',
  },
  {
    question: 'What does the monthly Reads price include?',
    answer: 'Poket Reads opens the shelf at Primary and Lower Secondary, plus general fiction, non-fiction and children’s stories on that shelf. It does not include every IGCSE, A-Level or LLB title. Those books sit on the same shelf. The first chapter of a published book is free to sample, and a book with a price can be bought and kept.',
  },
  {
    question: 'What is Reads Family?',
    answer: 'The same shelf for a household. You get more than one profile, and a child’s profile is filtered by age. On leaderboards, children are shown by nickname, for the world, a country or a school.',
  },
  {
    question: 'If I buy a book, do I keep it?',
    answer: 'Yes. A book you purchase stays in your library after a subscription ends.',
  },
  {
    question: 'What does Ask ET do inside a book?',
    answer: 'Ask ET answers from the chapter you have open and does not spoil what you have not read. Chapter quizzes are written the same way. From a book, ET AI can also make flashcards, a mind map and a summary.',
  },
  {
    question: 'Can I change the type, and can I read offline?',
    answer: 'The reader has light, sepia and dark themes, a dyslexia-friendly typeface, and chapters can be saved for offline reading. You can set a reading goal and keep a streak.',
  },
  {
    question: 'Who decides what gets published?',
    answer: `A person reviews a new title before it is published. Poket Reads speaks ${READS_OFFER_LANGUAGE_COUNT} languages, and a book can be translated rather than replaced.`,
  },
  {
    question: 'Is there a guarantee or a bonus?',
    answer: 'Not yet. The guarantee and the bonuses on this page are placeholders. They are not an offer until Harry replaces them with terms he has confirmed.',
  },
  {
    question: 'Does the yearly price expire?',
    answer: 'No. There is no countdown. The yearly price is ten times the monthly price, which means two months are not billed. That is the ordinary price.',
  },
];

export interface OfferPlaceholder {
  id: string;
  kind: 'testimonial' | 'guarantee' | 'bonus';
  label: string;
  note: string;
}

export const READS_OFFER_PLACEHOLDERS: OfferPlaceholder[] = [
  {
    id: 'testimonial-1',
    kind: 'testimonial',
    label: 'Testimonial placeholder',
    note: 'Not a customer quote. Replace with a real parent or student, their words, and permission to use them. Do not invent a name, a rating or a result.',
  },
  {
    id: 'testimonial-2',
    kind: 'testimonial',
    label: 'Testimonial placeholder',
    note: 'Not a customer quote. A second real voice belongs here, or the slot should be removed before the page is advertised.',
  },
  {
    id: 'testimonial-3',
    kind: 'testimonial',
    label: 'Testimonial placeholder',
    note: 'Not a customer quote. Leave this empty of fiction. No star rating and no “joined by thousands”.',
  },
  {
    id: 'guarantee',
    kind: 'guarantee',
    label: 'Guarantee placeholder',
    note: 'Harry must confirm this before it is a promise. Decide the number of days, whether the first subscription payment is refunded, and whether a book bought outright is included. Until this box is replaced, Poket Reads is sold without a money-back guarantee stated on this page.',
  },
  {
    id: 'bonuses',
    kind: 'bonus',
    label: 'Bonus placeholder',
    note: 'Harry must confirm this before it is advertised. No bonus ships with Poket Reads unless it is named here in plain terms. Do not leave a suggested bonus looking like it is included.',
  },
];

export function readsOfferJsonLd() {
  const productOffers = READS_OFFER_CHECKOUTS.map(item => ({
    '@type': 'Offer',
    name: `${item.name} (${item.cadence})`,
    price: item.usd.toFixed(2),
    priceCurrency: 'USD',
    url: `https://poketschool.ai${readsCheckoutHref(item.sku, item.interval)}`,
    availability: 'https://schema.org/InStock',
    category: item.interval === 'year' ? 'Annual subscription' : 'Monthly subscription',
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: 'Poket Reads',
        description: 'A reading subscription and buy-to-own bookshelf from Poket School, sold on its own. Primary and Lower Secondary books, general fiction and non-fiction, and academic titles you can sample or buy.',
        brand: { '@type': 'Brand', name: 'Poket School' },
        manufacturer: { '@type': 'Organization', name: LEGAL_ENTITY },
        url: READS_OFFER_URL,
        image: 'https://poketschool.ai/reads/offer/og.jpg',
        offers: productOffers,
      },
      {
        '@type': 'FAQPage',
        mainEntity: READS_OFFER_FAQ.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  };
}
