import { LEGAL_COMPANY_NO, LEGAL_ENTITY } from './legal';
import { LANGUAGES } from './languages';
import {
  READS_BOOKS,
  READS_BOOK_USD,
  booksVersusUnlimitedLine,
  formatShelfUsd,
  ownOrReadLine,
  readsDailyUsd,
  readsPlanItem,
} from './payments/reads';

export { READS_BOOK_USD, booksVersusUnlimitedLine, ownOrReadLine, readsDailyUsd, formatShelfUsd };

/** Public sales letter. Separate from the Poket School plan ladder at /offer. */
export const READS_OFFER_PATH = '/reads/offer';
export const READS_OFFER_URL = `https://poketschool.ai${READS_OFFER_PATH}`;

/** Interface languages. A book is translated one title at a time, not all at once. */
export const READS_OFFER_LANGUAGE_COUNT = LANGUAGES.length;

export const READS_OFFER_ENTITY = LEGAL_ENTITY;
export const READS_OFFER_COMPANY_NO = LEGAL_COMPANY_NO;

function readsUsd(sku: 'reads' | 'reads-family', interval: 'month' | 'year'): number {
  const item = readsPlanItem(sku, interval);
  if (!item) throw new Error(`Unknown Reads plan ${sku}`);
  return item.unitAmount;
}

export function readsMonthlyUsd(sku: 'reads' | 'reads-family'): number {
  return readsUsd(sku, 'month');
}

/** Annual Reads is the stored yearly amount on the shared shelf, not ten times the month. */
export function readsYearlyUsd(sku: 'reads' | 'reads-family'): number {
  return readsUsd(sku, 'year');
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
    detail: 'The same shelf, billed once at the yearly price.',
    cta: 'Subscribe yearly',
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
    detail: 'The household shelf for the year, at the yearly price. Same age filters.',
    cta: 'Start Family yearly',
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
    answer: `Poket Reads is ${formatShelfUsd(readsMonthlyUsd('reads'))} a month, or ${formatShelfUsd(readsYearlyUsd('reads'))} for the year. It opens the shelf at Primary and Lower Secondary, plus general fiction, non-fiction and children’s stories on that shelf. It does not include every IGCSE, A-Level or LLB title. Those books sit on the same shelf. The first chapter of a published book is free to sample. Any book is ${formatShelfUsd(READS_BOOK_USD)} to buy and keep. ${booksVersusUnlimitedLine()}.`,
  },
  {
    question: 'What is Reads Family?',
    answer: `The same shelf for a household, at ${formatShelfUsd(readsMonthlyUsd('reads-family'))} a month or ${formatShelfUsd(readsYearlyUsd('reads-family'))} for the year. You get more than one profile, and a child’s profile is filtered by age. On leaderboards, children are shown by nickname, for the world, a country or a school.`,
  },
  {
    question: 'If I buy a book, do I keep it?',
    answer: `Yes. A book is ${formatShelfUsd(READS_BOOK_USD)} to buy, and it stays in your library after a subscription ends.`,
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
    question: 'Does the yearly price expire?',
    answer: `No. There is no countdown. The yearly price is ${formatShelfUsd(readsYearlyUsd('reads'))} for Reads and ${formatShelfUsd(readsYearlyUsd('reads-family'))} for Reads Family. That is the ordinary price on the card.`,
  },
];

/**
 * Founder's note. Edit the paragraphs here. They are Harry's words on the
 * page, in the first person, and they only restate facts already in the product.
 */
export const READS_OFFER_FOUNDER = {
  name: 'Harry Seggu',
  role: 'Founder, Poket School',
  paragraphs: [
    'I am Harry Seggu, founder of Poket School.',
    'Poket Reads is a shelf we sell on its own, from Malaysia. Kindle Unlimited is not sold here. Amazon Kids+ is not sold here. A household can subscribe, or buy one published book and keep it.',
    `The figures on this page are the prices in the product. A book is ${readsUsdWords(READS_BOOK_USD)} to buy and keep. Reads is ${readsUsdWords(readsMonthlyUsd('reads'))} a month, or ${readsUsdWords(readsYearlyUsd('reads'))} for the year. Reads Family is ${readsUsdWords(readsMonthlyUsd('reads-family'))} a month, or ${readsUsdWords(readsYearlyUsd('reads-family'))} for the year. ${booksVersusUnlimitedLine()}. The subscription opens Primary and Lower Secondary, plus general fiction, non-fiction and children’s stories on that shelf. IGCSE, A-Level and LLB titles can be sampled and bought. They are not included in that monthly price.`,
    'The lines under Read a page are the openings of published chapters. I have not put a customer’s words on this page. We do not have them yet.',
  ],
} as const;

/** Real reader reviews. Leave this empty until a reader has given words and permission. */
export interface OfferTestimonial {
  id: string;
  quote: string;
  name: string;
  detail: string;
}

export const READS_OFFER_TESTIMONIALS: readonly OfferTestimonial[] = [];

export const READS_OFFER_REVIEW_MAIL = 'hello@poketschool.ai';

function readsUsdWords(amount: number): string {
  return `${amount.toFixed(2)} US dollars`;
}

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
        description: `A reading subscription and buy-to-own bookshelf from Poket School, sold on its own. ${ownOrReadLine()}. Primary and Lower Secondary books, general fiction and non-fiction, and academic titles you can sample or buy.`,
        brand: { '@type': 'Brand', name: 'Poket School' },
        manufacturer: { '@type': 'Organization', name: LEGAL_ENTITY },
        url: READS_OFFER_URL,
        image: 'https://poketschool.ai/reads/offer/og.jpg',
        offers: [
          ...productOffers,
          {
            '@type': 'Offer',
            name: 'Own a book',
            price: READS_BOOK_USD.toFixed(2),
            priceCurrency: 'USD',
            url: READS_OFFER_URL,
            availability: 'https://schema.org/InStock',
            category: 'Buy to own',
          },
        ],
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
