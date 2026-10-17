/**
 * Public /offer landing copy and the one switch for bundle extras.
 *
 * Poket Reads on the All-In plan, and the 1-week ET AI Live taster, render as
 * ordinary included items only while OFFER_BUNDLE_EXTRAS is true.
 * Standalone Poket Reads uses the shared shelf price and links to /reads/offer.
 */

import { booksVersusUnlimitedLine, ownOrReadLine, readsPlanItem } from './payments/reads';

export const OFFER_BUNDLE_EXTRAS = true;

export const OFFER_ROUTES = {
  home: '/',
  signup: '/signup',
  /** Existing checkout for the live IGCSE & A-Level plan at $79/mo. */
  allIn: '/dashboard/checkout?kind=subscription&sku=igcse_alevel',
  primary: '/dashboard/checkout?kind=subscription&sku=primary_secondary',
  professional: '/dashboard/checkout?kind=subscription&sku=professional',
  family: '/signup?role=parent',
  /** Standalone Poket Reads sales letter. */
  reads: '/reads/offer',
  institutions: 'mailto:institutions@poketschool.ai?subject=Poket%20School%20for%20institutions',
} as const;

export const offerCopy = {
  brand: 'Poket School',
  domain: 'PoketSchool.Ai',
  home: 'Home',
  startFree: 'Start free',
  meta: {
    title: 'Your child’s whole school, taught by ET AI',
    description:
      'ET Maths, ET Physics, ET English and 30+ ET AI teachers explain, mark and track progress in 53 languages — from Primary to IGCSE, A-Level and professional degrees.',
  },
  hero: {
    eyebrow: 'PoketSchool.Ai',
    headline: 'Your child’s whole school, taught by ET AI.',
    subhead:
      'ET Maths, ET Physics, ET English and 30+ ET AI teachers explain, mark and track progress in 53 languages — from Primary to IGCSE, A-Level and professional degrees.',
    primaryCta: 'Go All-In — $79/mo',
    secondaryCta: 'Start free — try any first lesson',
    micro: 'No card needed for Free Preview. Cancel anytime.',
    worth:
      'Less than the cost of one private tuition hour a week — for every subject, every day, with ET AI.',
  },
  benefits: {
    title: 'Built for the school day',
    items: [
      {
        title: 'Stuck? Snap it.',
        body: 'ET Maths turns a photo of any problem into clear, step-by-step working.',
      },
      {
        title: 'Exam-ready marking.',
        body: 'ET Exams and the ET AI Essay Writer grade in 9-1, % and A*-U, with feedback on what to fix next.',
      },
      {
        title: 'Every subject, one plan.',
        body: '30+ ET AI teachers across levels, plus Pre-University and Foundation on IGCSE & A-Level.',
      },
      {
        title: 'Parents see everything.',
        body: 'Dashboard, reports, attendance and daily goals — progress you can actually check.',
      },
      {
        title: 'Proof that travels.',
        body: 'Open Badges certificates shareable on LinkedIn, plus downloadable transcripts.',
      },
    ],
  },
  plans: {
    title: 'Plans',
    lede: 'Prices in USD. Start free, then upgrade when you are ready.',
    popular: 'MOST POPULAR',
  },
  features: {
    title: 'Included on paid plans',
    lede: 'The same ET AI teachers, marking, and parent tools, at every paid level.',
  },
  stats: [
    { value: '30+', label: 'ET AI teachers' },
    { value: '53', label: 'languages' },
    { value: 'A1–C2', label: 'CEFR language levels' },
    { value: 'Open Badges', label: 'LinkedIn-ready certificates' },
  ],
  faq: {
    title: 'Is it worth it?',
    body: 'For $79 a month — about $2.60 a day — your child gets 30+ ET AI teachers, exam-style marking and a parent dashboard across every IGCSE and A-Level subject, often less than a single hour of private tuition a week. Go annual and it drops to $59 a month.',
  },
  footer: {
    company: 'Poket Media Sdn Bhd (1332289-X)',
    line: 'Poket School is operated by Poket Media Sdn Bhd (1332289-X). Prices in USD.',
    domain: 'PoketSchool.Ai',
  },
} as const;

export interface OfferPlan {
  id: string;
  name: string;
  price: string;
  priceNote: string;
  tagline: string;
  features: readonly string[];
  cta: string;
  href: string;
  external?: boolean;
  popular?: boolean;
  /** Electric cyan is the Reads call to action. Other plans stay on the shared blue. */
  ctaTone?: 'cyan';
}

const ALL_IN_FEATURES = [
  '30+ ET AI teachers',
  '800 Sparks/mo',
  'ET Exams and the ET AI Essay Writer (9-1, %, A*-U)',
  'Pre-University and Foundation',
] as const;

const BUNDLE_EXTRAS = [
  'Poket Reads included',
  '1-week ET AI Live taster',
] as const;

function shelfUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function readsShelfPrice(): { price: string; priceNote: string; family: string; choice: string; compare: string } {
  const month = readsPlanItem('reads', 'month');
  const year = readsPlanItem('reads', 'year');
  const familyMonth = readsPlanItem('reads-family', 'month');
  const familyYear = readsPlanItem('reads-family', 'year');
  if (!month || !year || !familyMonth || !familyYear) {
    throw new Error('Reads price is missing from the shared shelf.');
  }
  return {
    price: `${shelfUsd(month.unitAmount)}/mo`,
    priceNote: `${shelfUsd(year.unitAmount)}/yr`,
    family: `Reads Family ${shelfUsd(familyMonth.unitAmount)}/mo or ${shelfUsd(familyYear.unitAmount)}/yr`,
    choice: ownOrReadLine(),
    compare: booksVersusUnlimitedLine(),
  };
}

export function offerPlans(extras: boolean = OFFER_BUNDLE_EXTRAS): OfferPlan[] {
  const reads = readsShelfPrice();
  return [
    {
      id: 'preview',
      name: 'Free Preview',
      price: '$0',
      priceNote: 'No card',
      tagline: 'Look around before you commit.',
      features: [
        'Full course catalogue',
        'First lesson of any course',
        'Certificate verification',
      ],
      cta: 'Start free',
      href: OFFER_ROUTES.signup,
    },
    {
      id: 'primary',
      name: 'Primary & Lower Secondary',
      price: '$19/mo',
      priceNote: '$171/yr',
      tagline: 'Strong foundations, every day.',
      features: [
        'ET AI teachers for core subjects',
        '300 Sparks/mo',
        'Daily goals',
        'Parent dashboard and reports',
      ],
      cta: 'Choose Primary',
      href: OFFER_ROUTES.primary,
    },
    {
      id: 'all-in',
      name: 'IGCSE & A-Level — All-In',
      price: '$79/mo',
      priceNote: '$708/yr ($59/mo)',
      tagline: 'Everything for top grades.',
      features: extras ? [...ALL_IN_FEATURES, ...BUNDLE_EXTRAS] : [...ALL_IN_FEATURES],
      cta: 'Go All-In',
      href: OFFER_ROUTES.allIn,
      popular: true,
    },
    {
      id: 'professional',
      name: 'Professional & Degrees',
      price: '$99/mo',
      priceNote: '$888/yr ($74/mo)',
      tagline: 'Degree-level study with ET AI.',
      features: [
        'MBBS Medicine',
        'LLB Law (University of London and others)',
        'Engineering',
        'Nursing',
        'Transcripts and Open Badges',
      ],
      cta: 'Choose Professional',
      href: OFFER_ROUTES.professional,
    },
    {
      id: 'family',
      name: 'Family',
      price: '30% off',
      priceNote: '2nd child',
      tagline: 'More learners, less per child.',
      features: [
        'Add a second child to any plan at 30% off',
        'Primary & Lower Secondary from $13.30/mo',
        'IGCSE & A-Level from $55.30/mo',
        'One parent dashboard for all',
      ],
      cta: 'Add a child',
      href: OFFER_ROUTES.family,
    },
    {
      id: 'reads',
      name: 'Poket Reads',
      price: reads.price,
      priceNote: reads.priceNote,
      tagline: reads.choice,
      features: [
        reads.compare,
        reads.family,
        'Books and audiobooks',
        'Children’s illustrated stories',
        'ET AI book studio',
        'For learners without a school plan',
      ],
      cta: 'Get Poket Reads',
      href: OFFER_ROUTES.reads,
      ctaTone: 'cyan',
    },
    {
      id: 'institutions',
      name: 'Institutions',
      price: 'Per student',
      priceNote: 'Volume pricing',
      tagline: 'Your school, powered by ET AI.',
      features: [
        'White-label platform',
        'Volume tiers from 1–10 to 301+ students',
        'Attendance, reports, and admin dashboards',
      ],
      cta: 'Talk to us',
      href: OFFER_ROUTES.institutions,
      external: true,
    },
  ];
}

export interface OfferFeature {
  title: string;
  body: string;
}

const BASE_FEATURES: readonly OfferFeature[] = [
  {
    title: 'ET AI teachers',
    body: '30+ subject teachers — ET Maths, ET Biology, ET Economics and more.',
  },
  {
    title: 'ET Maths',
    body: 'Snap a photo of any problem and get step-by-step working.',
  },
  {
    title: 'ET Exams',
    body: 'Exam-style practice with instant feedback.',
  },
  {
    title: 'ET AI Essay Writer',
    body: 'Feedback and grades in 9-1, % and A*-U.',
  },
  {
    title: 'ET AI Studio',
    body: 'Create, revise and build study material with ET AI.',
  },
  {
    title: 'ET AI Live',
    body: 'Live sessions add-on.',
  },
  {
    title: 'Certificates',
    body: 'Open Badges with LinkedIn sharing, and downloadable transcripts.',
  },
  {
    title: 'Parents',
    body: 'Parent dashboard and reports, attendance, and daily goals.',
  },
  {
    title: 'Languages',
    body: '53 languages. Language courses mapped to CEFR A1–C2.',
  },
  {
    title: 'Levels',
    body: 'Primary, Lower Secondary, IGCSE, A-Level, Pre-University, Foundation, Degree, Professional.',
  },
  {
    title: 'Institutions',
    body: 'White-label platform for schools and colleges.',
  },
];

const EXTRA_FEATURES: readonly OfferFeature[] = [
  {
    title: 'Poket Reads',
    body: 'Books, audiobooks, children’s illustrated stories, and the ET AI book studio — included on IGCSE & A-Level All-In.',
  },
  {
    title: 'ET AI Live taster',
    body: 'A 1-week ET AI Live taster on IGCSE & A-Level All-In.',
  },
];

export function offerIncludedFeatures(extras: boolean = OFFER_BUNDLE_EXTRAS): OfferFeature[] {
  if (!extras) return [...BASE_FEATURES];
  const live = BASE_FEATURES.filter((feature) => feature.title !== 'ET AI Live');
  return [
    ...live,
    {
      title: 'ET AI Live',
      body: 'Live sessions add-on, with a 1-week ET AI Live taster on IGCSE & A-Level All-In.',
    },
    ...EXTRA_FEATURES.filter((feature) => feature.title === 'Poket Reads'),
  ];
}

/** Every string the public page can show, including copy hidden by the flag. */
export function offerPublicStrings(): string[] {
  const strings: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(offerCopy);
  walk(offerPlans(true));
  walk(offerPlans(false));
  walk(offerIncludedFeatures(true));
  walk(offerIncludedFeatures(false));
  walk(BUNDLE_EXTRAS);
  return strings;
}
