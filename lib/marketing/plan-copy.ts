/** Plan descriptions only. Prices and entitlements come from the live pricing configuration. */
export interface PlanCopy {
  id: string;
  name: string;
  tagline: string;
  tier: number;
  popular?: boolean;
  cta: string;
  features: string[];
}

const PREVIEW_EXTRAS = [
  'ET AI tutor — 20 messages a day',
  'ET AI generator — 3 items a day',
  'Buy any marketplace course outright',
];

const PRIMARY_EXTRAS = [
  'Unlimited ET AI study materials',
  'Progress tracking and streaks',
];

const IGCSE_EXTRAS = [
  'ET AI tutor, unlimited',
  "Bloom's progress tracking",
];

/** Marketing copy for the sold plans. Amounts come from the pricing document. */
export const PLANS: PlanCopy[] = [
  {
    id: 'preview',
    name: 'Free Preview',
    tier: 0,
    tagline: 'Browse everything, and take the first lesson of any course. No card, no countdown.',
    cta: 'Start free',
    features: PREVIEW_EXTRAS,
  },
  {
    id: 'primary_secondary',
    name: 'Primary & Lower Secondary',
    tier: 1,
    tagline: 'Primary and Lower Secondary. Every core subject, built to the curriculum.',
    cta: 'Choose this plan',
    features: PRIMARY_EXTRAS,
  },
  {
    id: 'igcse_alevel',
    name: 'IGCSE & A-Level',
    tier: 2,
    tagline: 'IGCSE to A-Level, with everything below included.',
    popular: true,
    cta: 'Choose this plan',
    features: IGCSE_EXTRAS,
  },
  {
    id: 'professional',
    name: 'Professional & Degrees',
    tier: 3,
    tagline: 'MBBS Medicine, LLB Law (University of London and other universities), Engineering and Nursing.',
    cta: 'Choose this plan',
    features: [],
  },
];

