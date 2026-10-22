import { FUNNEL_COPY } from './copy';
import type { FlowStep } from '@/lib/flow/steps';
import { isSuperAdminEmail } from '@/lib/roles';

export const FUNNEL_STEPS: readonly FlowStep[] = [
  { id: 'template', label: 'Choose template' },
  { id: 'sections', label: 'Edit sections' },
  { id: 'preview', label: 'Preview' },
  { id: 'publish', label: 'Publish' },
];

export const FUNNEL_STEP_IDS = ['template', 'sections', 'preview', 'publish'] as const;
export type FunnelStepId = (typeof FUNNEL_STEP_IDS)[number];

export const SECTION_KINDS = ['hero', 'benefits', 'pricing', 'testimonials', 'faq', 'cta'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const FUNNEL_TEMPLATES = ['blank', 'course', 'school'] as const;
export type FunnelTemplate = (typeof FUNNEL_TEMPLATES)[number];

export type FunnelStatus = 'draft' | 'published';

export interface FunnelItem {
  title: string;
  body: string;
  price: string;
}

export interface FunnelSection {
  id: string;
  kind: SectionKind;
  heading: string;
  lede: string;
  button: string;
  body: string;
  items: FunnelItem[];
}

export interface FunnelRecord {
  id: string;
  title: string;
  slug: string;
  status: FunnelStatus;
  template: FunnelTemplate;
  sections: FunnelSection[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface FunnelSummary {
  id: string;
  title: string;
  slug: string;
  status: FunnelStatus;
  template: FunnelTemplate;
  updatedAt: number;
}

export interface FunnelLead {
  id: string;
  funnelId: string;
  slug: string;
  name: string;
  email: string;
  note: string;
  createdAt: number;
}

export interface PublicFunnel {
  title: string;
  slug: string;
  sections: FunnelSection[];
}

const STAFF_ADMIN_ROLES = new Set(['admin', 'super_admin']);

export function isFunnelStep(value: string): value is FunnelStepId {
  return (FUNNEL_STEP_IDS as readonly string[]).includes(value);
}

export function isSectionKind(value: string): value is SectionKind {
  return (SECTION_KINDS as readonly string[]).includes(value);
}

export function isFunnelTemplate(value: string): value is FunnelTemplate {
  return (FUNNEL_TEMPLATES as readonly string[]).includes(value);
}

/** Letters, numbers, and single hyphens. Two to 48 characters. */
export function validSlug(value: string): boolean {
  return value.length >= 2 && value.length <= 48 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

export function nextCopySlug(slug: string, taken: ReadonlySet<string>): string {
  const base = validSlug(slug) ? slug : 'page';
  const candidates = [`${base}-copy`, ...Array.from({ length: 40 }, (_, index) => `${base}-${index + 2}`)];
  for (const candidate of candidates) {
    const clipped = candidate.slice(0, 48).replace(/-+$/g, '');
    if (validSlug(clipped) && !taken.has(clipped)) return clipped;
  }
  for (let index = 2; index < 100; index += 1) {
    const fallback = `page-${index}`;
    if (!taken.has(fallback)) return fallback;
  }
  return 'page-copy';
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function item(title: string, body: string, price = ''): FunnelItem {
  return { title: clip(title, 80), body: clip(body, 400), price: clip(price, 40) };
}

function section(id: string, kind: SectionKind, patch: Partial<FunnelSection>): FunnelSection {
  return {
    id,
    kind,
    heading: clip(patch.heading ?? '', 120),
    lede: clip(patch.lede ?? '', 400),
    button: clip(patch.button ?? '', 40),
    body: clip(patch.body ?? '', 500),
    items: (patch.items ?? []).slice(0, 8).map((entry) => item(entry.title, entry.body, entry.price)),
  };
}

const S = FUNNEL_COPY.starters;

function hero(id: string): FunnelSection {
  return section(id, 'hero', { heading: S.heroHeading, lede: S.heroLede, button: S.heroButton });
}

function benefits(id: string): FunnelSection {
  return section(id, 'benefits', {
    heading: S.benefitsHeading,
    items: [item(S.benefitTitle, S.benefitBody)],
  });
}

function pricing(id: string): FunnelSection {
  return section(id, 'pricing', {
    heading: S.pricingHeading,
    items: [
      item('Free preview', 'The catalogue and the first lesson of a course.', '$0'),
      item('Primary', 'Primary pathway, ET AI teachers, ET AI Studio, and the parent dashboard.', '$49'),
      item('IGCSE and A-Level', 'IGCSE, A-Level, and Primary. Exam Prep and the parent dashboard.', '$79'),
      item('LLB and MBBS', 'Law and medicine pathways. The IGCSE plan is included.', '$99'),
      item('Micro and professional', 'Independent study without a school enrolment.', '$19'),
    ],
  });
}

function testimonials(id: string): FunnelSection {
  return section(id, 'testimonials', { heading: S.testimonialsHeading, items: [] });
}

function faq(id: string): FunnelSection {
  return section(id, 'faq', {
    heading: S.faqHeading,
    items: [item(S.faqQuestion, S.faqAnswer)],
  });
}

function cta(id: string): FunnelSection {
  return section(id, 'cta', { heading: S.ctaHeading, body: S.ctaBody, button: S.ctaButton });
}

export function templateSections(template: FunnelTemplate): FunnelSection[] {
  if (template === 'blank') return [hero('hero-1'), cta('cta-1')];
  if (template === 'school') return [hero('hero-1'), benefits('benefits-1'), faq('faq-1'), cta('cta-1')];
  return [hero('hero-1'), benefits('benefits-1'), pricing('pricing-1'), testimonials('testimonials-1'), faq('faq-1'), cta('cta-1')];
}

export function templateTitle(template: FunnelTemplate): string {
  if (template === 'blank') return S.blankTitle;
  if (template === 'school') return S.schoolTitle;
  return S.courseTitle;
}

export function emptySection(kind: SectionKind, id: string): FunnelSection {
  if (kind === 'hero') return hero(id);
  if (kind === 'benefits') return benefits(id);
  if (kind === 'pricing') return pricing(id);
  if (kind === 'testimonials') return testimonials(id);
  if (kind === 'faq') return faq(id);
  return cta(id);
}

export function parseSection(value: unknown, index: number): FunnelSection | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const kind = typeof raw.kind === 'string' && isSectionKind(raw.kind) ? raw.kind : null;
  if (!kind) return null;
  const id = typeof raw.id === 'string' && /^[a-z0-9-]{1,40}$/.test(raw.id) ? raw.id : `${kind}-${index + 1}`;
  const items = Array.isArray(raw.items) ? raw.items.map((entry) => {
    const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return item(
      typeof row.title === 'string' ? row.title : '',
      typeof row.body === 'string' ? row.body : '',
      typeof row.price === 'string' ? row.price : '',
    );
  }) : [];
  return section(id, kind, {
    heading: typeof raw.heading === 'string' ? raw.heading : '',
    lede: typeof raw.lede === 'string' ? raw.lede : '',
    button: typeof raw.button === 'string' ? raw.button : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    items,
  });
}

export function parseSections(value: unknown): FunnelSection[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => parseSection(entry, index)).filter((entry): entry is FunnelSection => entry !== null).slice(0, 12);
}

export function summarize(record: FunnelRecord): FunnelSummary {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    status: record.status,
    template: record.template,
    updatedAt: record.updatedAt,
  };
}

export function toPublic(record: FunnelRecord): PublicFunnel {
  return { title: record.title, slug: record.slug, sections: record.sections };
}

export function validLeadEmail(value: string): boolean {
  return value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Platform admins only. A staff adminRole such as support does not qualify.
 * A token role other than admin is final and is not upgraded from the profile.
 */
export function funnelAdminAllowed(input: {
  email?: string | null;
  tokenRole?: string | null;
  tokenAdminRole?: string | null;
  profileRole?: string | null;
  profileAdminRole?: string | null;
}): boolean {
  if (isSuperAdminEmail(input.email)) return true;
  if (input.tokenRole && input.tokenRole !== 'admin') return false;
  const role = input.tokenRole === 'admin' ? 'admin' : (input.profileRole ?? '');
  if (role !== 'admin') return false;
  const staff = input.tokenAdminRole || input.profileAdminRole || '';
  if (staff && !STAFF_ADMIN_ROLES.has(staff)) return false;
  return true;
}

export function funnelDeskAllowed(actor: { role?: string | null; email?: string | null; adminRole?: string | null } | null | undefined): boolean {
  if (!actor) return false;
  return funnelAdminAllowed({
    email: actor.email,
    tokenRole: actor.role,
    tokenAdminRole: actor.adminRole,
  });
}
