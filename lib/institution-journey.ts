/**
 * First visit for someone registering a school or organisation.
 * Pure decisions live here. Pages and the register API call them.
 */

import type { InstitutionType } from './enterprise';
import { INSTITUTION_TYPES } from './enterprise';
import { statesForCountry } from './institution-states';
import { normaliseSubdomain } from './tenant-host';

export const INSTITUTION_LOGIN_PATH = '/institutions/login';
export const INSTITUTION_REGISTER_PATH = '/institutions/register';
export const INSTITUTION_PENDING_PATH = '/institutions/pending';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InstitutionApplication {
  organisation: string;
  type: InstitutionType;
  country: string;
  state: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  gender: 'male' | 'female';
  password: string;
}

export type ApplicationResult =
  | { ok: true; value: InstitutionApplication }
  | { ok: false; error: string };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Reject a half-filled application before any account is created. */
export function validateInstitutionApplication(input: {
  organisation?: unknown;
  type?: unknown;
  country?: unknown;
  state?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  title?: unknown;
  gender?: unknown;
  password?: unknown;
}): ApplicationResult {
  const organisation = text(input.organisation);
  const type = text(input.type);
  const country = text(input.country).toUpperCase();
  const state = text(input.state);
  const name = text(input.name);
  const email = text(input.email).toLowerCase();
  const phone = text(input.phone);
  const title = text(input.title);
  const gender = text(input.gender);
  const password = typeof input.password === 'string' ? input.password : '';

  if (organisation.length < 2) return { ok: false, error: 'Enter the organisation name.' };
  if (!INSTITUTION_TYPES.includes(type as InstitutionType)) return { ok: false, error: 'Choose an organisation type.' };
  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, error: 'Choose a country.' };
  const states = statesForCountry(country);
  if (!state || !states.includes(state)) return { ok: false, error: 'Choose a state or region.' };
  if (name.length < 2) return { ok: false, error: 'Enter your name.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a work email address.' };
  if (phone.replace(/\D/g, '').length < 7) return { ok: false, error: 'Enter a work phone number.' };
  if (title.length < 2) return { ok: false, error: 'Enter your role or title.' };
  if (gender !== 'male' && gender !== 'female') return { ok: false, error: 'Choose Male or Female.' };
  if (password.length < 8) return { ok: false, error: 'Use at least 8 characters for the password.' };

  return {
    ok: true,
    value: {
      organisation,
      type: type as InstitutionType,
      country,
      state,
      name,
      email,
      phone,
      title,
      gender,
      password,
    },
  };
}

/**
 * Where an institution admin goes after a successful sign-in.
 * Academies created before this checklist have no setupComplete flag and
 * keep opening the dashboard.
 */
export function institutionAdminDestination(input: {
  status?: string | null;
  setupComplete?: boolean | null;
  billingPhase?: string | null;
  reviewHold?: boolean | null;
}): string {
  if (input.status === 'pending' && input.billingPhase === 'pending_payment' && !input.reviewHold) {
    return '/institutions/checkout';
  }
  if (input.status === 'pending' || input.status === 'suspended' || !input.status) {
    return INSTITUTION_PENDING_PATH;
  }
  if (input.status === 'active' && input.setupComplete === false) {
    return '/dashboard/institution/onboarding';
  }
  return '/dashboard/institution';
}

/**
 * False hides a published page. True shows it. A subdomain with no flag is
 * already live, so existing academies stay on their login page.
 */
export function loginPageIsLive(institution: {
  subdomain?: string | null;
  branding?: { loginPublished?: boolean } | null;
}): boolean {
  const published = institution.branding?.loginPublished;
  if (published === false) return false;
  if (published === true) return true;
  return Boolean(institution.subdomain);
}

export function slugAvailabilityLabel(slug: string, available: boolean | null): string {
  const normal = normaliseSubdomain(slug);
  if (!normal) return 'Use 3 to 63 letters or numbers, for example rochfords.';
  if (available === null) return `Checking poketschool.ai/i/${normal}…`;
  if (available) return `${normal} is available. The login page will be poketschool.ai/i/${normal}.`;
  return `${normal} is already in use. Choose another address.`;
}

export const JOURNEY_STEPS = [
  { id: 'profile', label: 'Academy name, country, and state', href: '/dashboard/institution' },
  { id: 'brand', label: 'Branded login page', href: '/dashboard/institution/onboarding#branded-login' },
  { id: 'coadmins', label: 'Invite co-admins, with an email code', href: '/dashboard/institution#academy-invite' },
  { id: 'teachers', label: 'Add teachers', href: '/dashboard/institution#academy-invite' },
  { id: 'students', label: 'Invite students with a code, a CSV, or a QR', href: '/dashboard/institution#academy-invite' },
  { id: 'courses', label: 'Pick courses', href: '/dashboard/institution/publishing' },
  { id: 'billing', label: 'Billing', href: '/dashboard/institution/billing' },
  { id: 'sparks', label: 'Sparks', href: '/dashboard/institution/sparks' },
] as const;

export type JourneyStepId = (typeof JOURNEY_STEPS)[number]['id'];

export function journeyChecklist(done: Partial<Record<JourneyStepId, boolean>>): { id: JourneyStepId; label: string; href: string; done: boolean }[] {
  return JOURNEY_STEPS.map((step) => ({ ...step, done: done[step.id] === true }));
}

export function journeyDone(input: {
  name?: string | null;
  country?: string | null;
  state?: string | null;
  subdomain?: string | null;
  loginPublished?: boolean | null;
  coAdminCount?: number;
  teacherCount?: number;
  studentCount?: number;
  inviteCount?: number;
  courseCount?: number;
  billingReady?: boolean;
  sparksReady?: boolean;
}): Record<JourneyStepId, boolean> {
  const students = (input.studentCount ?? 0) > 0 || (input.inviteCount ?? 0) > 0;
  return {
    profile: Boolean(input.name?.trim() && input.country?.trim() && input.state?.trim()),
    brand: input.loginPublished === true && Boolean(normaliseSubdomain(input.subdomain ?? '')),
    coadmins: (input.coAdminCount ?? 0) > 1,
    teachers: (input.teacherCount ?? 0) > 0,
    students,
    courses: (input.courseCount ?? 0) > 0,
    billing: input.billingReady === true,
    sparks: input.sparksReady === true,
  };
}

/** Marketing header, footer, and cookie bar stay off these doors. */
export function isInstitutionJourneyPath(pathname: string): boolean {
  const path = (pathname.split('?')[0]?.split('#')[0] ?? '').replace(/\/+$/, '') || '/';
  return path === '/institutions'
    || path.startsWith('/institutions/')
    || path === '/preview/institution-pending'
    || path === '/preview/institution-onboarding'
    || path === '/preview/institution-checkout';
}
