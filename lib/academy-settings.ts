/**
 * Per-academy policy. Firestore IO stays in lib/institution-store.ts.
 * Commercial seat and price fields stay on the private profile.
 */

import type { AcademyRole } from './enterprise';
import { LANGUAGES } from './languages';
import { taxRateFor } from './payments/tax';

export const SIGNUP_POLICIES = ['open', 'invite', 'domain'] as const;
export type SignupPolicy = (typeof SIGNUP_POLICIES)[number];

export const CATALOGUE_VISIBILITIES = ['private', 'curated', 'public'] as const;
export type CatalogueVisibility = (typeof CATALOGUE_VISIBILITIES)[number];

export const TENANT_FEATURES = [
  'learningPaths', 'skills', 'leaderboard', 'customPages', 'certificates', 'discussions', 'mobileApp', 'compliance',
] as const;
export type TenantFeature = (typeof TENANT_FEATURES)[number];

export const ACADEMY_PERMISSIONS = [
  'manage_settings', 'manage_people', 'manage_content', 'manage_billing', 'view_analytics', 'grade', 'learn',
] as const;
export type AcademyPermission = (typeof ACADEMY_PERMISSIONS)[number];

export const ROLE_DEFAULTS: Record<AcademyRole, readonly AcademyPermission[]> = {
  institution_admin: ACADEMY_PERMISSIONS,
  manager: ['manage_people', 'manage_content', 'view_analytics', 'grade', 'learn'],
  teacher: ['manage_content', 'grade', 'learn'],
  learner: ['learn'],
  parent: ['view_analytics', 'learn'],
};

export interface AcademyPage {
  slug: string;
  title: string;
  body: string;
  published: boolean;
}

export interface LeaderboardRow {
  name: string;
  points: number;
}

export interface AcademySettings {
  legalName: string;
  timezone: string;
  supportEmail: string;
  signupPolicy: SignupPolicy;
  allowedEmailDomains: string[];
  roleGrants: Record<AcademyRole, AcademyPermission[]>;
  defaultLocale: string;
  locales: string[];
  taxMode: 'platform' | 'exempt' | 'custom';
  taxRate: number;
  taxLabel: string;
  notifyEnrolment: boolean;
  notifyCompletion: boolean;
  notifyCompliance: boolean;
  notifyDigest: 'off' | 'daily' | 'weekly';
  emailWelcomeSubject: string;
  emailWelcomeBody: string;
  emailReminderSubject: string;
  emailReminderBody: string;
  emailCertificateSubject: string;
  emailCertificateBody: string;
  certificateTitle: string;
  certificateBody: string;
  certificateSignatory: string;
  catalogueVisibility: CatalogueVisibility;
  features: Record<TenantFeature, boolean>;
  retentionMonths: number;
  privacyContact: string;
  require2fa: boolean;
  passwordMinLength: number;
  passwordRequireSymbol: boolean;
  sessionTimeoutMinutes: number;
  ipAllowlist: string[];
  leaderboardVisible: 'academy' | 'group' | 'off';
  leaderboard: LeaderboardRow[];
  pages: AcademyPage[];
  mobileAppName: string;
  mobileIconUrl: string;
  splashColor: string;
  iosBundleId: string;
  androidPackage: string;
  mobileSubtitle: string;
}

const LANGUAGE_CODES = new Set(LANGUAGES.map((language) => language.code));

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

export function blankAcademySettings(partial: Partial<AcademySettings> = {}): AcademySettings {
  const features = Object.fromEntries(TENANT_FEATURES.map((feature) => [
    feature,
    feature !== 'discussions',
  ])) as Record<TenantFeature, boolean>;
  const roleGrants = {
    institution_admin: [...ROLE_DEFAULTS.institution_admin],
    manager: [...ROLE_DEFAULTS.manager],
    teacher: [...ROLE_DEFAULTS.teacher],
    learner: [...ROLE_DEFAULTS.learner],
    parent: [...ROLE_DEFAULTS.parent],
  };
  return {
    legalName: '',
    timezone: 'Asia/Kuala_Lumpur',
    supportEmail: '',
    signupPolicy: 'invite',
    defaultLocale: 'en',
    taxMode: 'platform',
    taxRate: 0,
    taxLabel: '',
    notifyEnrolment: true,
    notifyCompletion: true,
    notifyCompliance: true,
    notifyDigest: 'weekly',
    emailWelcomeSubject: 'Welcome to {{school}}',
    emailWelcomeBody: 'Your academy login is ready.',
    emailReminderSubject: 'A required course is due',
    emailReminderBody: 'Open {{school}} to finish the assigned course.',
    emailCertificateSubject: 'Your certificate from {{school}}',
    emailCertificateBody: 'A certificate has been issued in your name.',
    certificateTitle: 'Certificate of Achievement',
    certificateBody: '{{name}} has completed {{course}}. Issued by {{issuer}}.',
    certificateSignatory: '',
    catalogueVisibility: 'curated',
    retentionMonths: 24,
    privacyContact: '',
    require2fa: false,
    passwordMinLength: 8,
    passwordRequireSymbol: false,
    sessionTimeoutMinutes: 0,
    leaderboardVisible: 'academy',
    mobileAppName: '',
    mobileIconUrl: '',
    splashColor: '',
    iosBundleId: '',
    androidPackage: '',
    mobileSubtitle: '',
    ...partial,
    roleGrants: { ...roleGrants, ...partial.roleGrants },
    features: { ...features, ...partial.features },
    allowedEmailDomains: partial.allowedEmailDomains ?? [],
    locales: partial.locales ?? ['en'],
    ipAllowlist: partial.ipAllowlist ?? [],
    leaderboard: partial.leaderboard ?? [],
    pages: partial.pages ?? [],
  };
}

function cleanDomain(value: string): string | null {
  const host = value.trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  return host;
}

export function normalisePageSlug(input: string): string | null {
  const slug = input.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (slug.length < 2 || slug.length > 40) return null;
  return slug;
}

export function sanitiseAcademySettings(input: unknown): AcademySettings {
  const source = input && typeof input === 'object' ? input as Partial<AcademySettings> : {};
  const base = blankAcademySettings();
  const domains = (Array.isArray(source.allowedEmailDomains) ? source.allowedEmailDomains : [])
    .map((domain) => cleanDomain(String(domain)))
    .filter((domain): domain is string => !!domain)
    .slice(0, 20);
  const locales = (Array.isArray(source.locales) ? source.locales : base.locales)
    .map((code) => String(code))
    .filter((code) => LANGUAGE_CODES.has(code))
    .slice(0, 12);
  const defaultLocale = LANGUAGE_CODES.has(String(source.defaultLocale)) ? String(source.defaultLocale) : 'en';
  const roleGrants = { ...base.roleGrants };
  const incomingGrants = (source.roleGrants && typeof source.roleGrants === 'object' ? source.roleGrants : {}) as Partial<Record<AcademyRole, unknown>>;
  (Object.keys(ROLE_DEFAULTS) as AcademyRole[]).forEach((role) => {
    const raw = incomingGrants[role];
    const picked = Array.isArray(raw)
      ? raw.filter((item): item is AcademyPermission => (ACADEMY_PERMISSIONS as readonly string[]).includes(String(item)))
      : [...ROLE_DEFAULTS[role]];
    roleGrants[role] = role === 'institution_admin' ? [...ACADEMY_PERMISSIONS] : [...new Set(picked)];
  });
  const features = { ...base.features };
  const incomingFeatures = (source.features && typeof source.features === 'object' ? source.features : {}) as Partial<Record<TenantFeature, unknown>>;
  TENANT_FEATURES.forEach((feature) => {
    features[feature] = asBool(incomingFeatures[feature], base.features[feature]);
  });
  const pages: AcademyPage[] = [];
  if (Array.isArray(source.pages)) {
    for (const page of source.pages.slice(0, 12)) {
      if (!page || typeof page !== 'object') continue;
      const record = page as Partial<AcademyPage>;
      const slug = normalisePageSlug(String(record.slug ?? record.title ?? ''));
      const title = asText(record.title, 80);
      if (!slug || !title) continue;
      pages.push({ slug, title, body: asText(record.body, 4000), published: record.published === true });
    }
  }
  const leaderboard: LeaderboardRow[] = [];
  if (Array.isArray(source.leaderboard)) {
    for (const row of source.leaderboard.slice(0, 50)) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Partial<LeaderboardRow>;
      const name = asText(record.name, 80);
      const points = Number(record.points);
      if (!name || !Number.isFinite(points)) continue;
      leaderboard.push({ name, points: Math.max(0, Math.round(points)) });
    }
  }
  const minLength = Number(source.passwordMinLength);
  const timeout = Number(source.sessionTimeoutMinutes);
  const retention = Number(source.retentionMonths);
  const taxRate = Number(source.taxRate);
  return {
    ...base,
    legalName: asText(source.legalName, 160),
    timezone: asText(source.timezone, 64) || base.timezone,
    supportEmail: asText(source.supportEmail, 160),
    signupPolicy: oneOf(source.signupPolicy, SIGNUP_POLICIES, base.signupPolicy),
    allowedEmailDomains: domains,
    roleGrants,
    defaultLocale,
    locales: locales.length ? [...new Set([defaultLocale, ...locales])] : [defaultLocale],
    taxMode: oneOf(source.taxMode, ['platform', 'exempt', 'custom'] as const, 'platform'),
    taxRate: Number.isFinite(taxRate) ? Math.min(0.3, Math.max(0, taxRate)) : 0,
    taxLabel: asText(source.taxLabel, 40),
    notifyEnrolment: asBool(source.notifyEnrolment, true),
    notifyCompletion: asBool(source.notifyCompletion, true),
    notifyCompliance: asBool(source.notifyCompliance, true),
    notifyDigest: oneOf(source.notifyDigest, ['off', 'daily', 'weekly'] as const, 'weekly'),
    emailWelcomeSubject: asText(source.emailWelcomeSubject, 160) || base.emailWelcomeSubject,
    emailWelcomeBody: asText(source.emailWelcomeBody, 2000) || base.emailWelcomeBody,
    emailReminderSubject: asText(source.emailReminderSubject, 160) || base.emailReminderSubject,
    emailReminderBody: asText(source.emailReminderBody, 2000) || base.emailReminderBody,
    emailCertificateSubject: asText(source.emailCertificateSubject, 160) || base.emailCertificateSubject,
    emailCertificateBody: asText(source.emailCertificateBody, 2000) || base.emailCertificateBody,
    certificateTitle: asText(source.certificateTitle, 120) || base.certificateTitle,
    certificateBody: asText(source.certificateBody, 2000) || base.certificateBody,
    certificateSignatory: asText(source.certificateSignatory, 120),
    catalogueVisibility: oneOf(source.catalogueVisibility, CATALOGUE_VISIBILITIES, 'curated'),
    features,
    retentionMonths: Number.isFinite(retention) ? Math.min(84, Math.max(6, Math.round(retention))) : 24,
    privacyContact: asText(source.privacyContact, 160),
    require2fa: asBool(source.require2fa, false),
    passwordMinLength: Number.isFinite(minLength) ? Math.min(64, Math.max(8, Math.round(minLength))) : 8,
    passwordRequireSymbol: asBool(source.passwordRequireSymbol, false),
    sessionTimeoutMinutes: !Number.isFinite(timeout) || timeout <= 0 ? 0 : Math.min(720, Math.max(15, Math.round(timeout))),
    ipAllowlist: (Array.isArray(source.ipAllowlist) ? source.ipAllowlist : [])
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0 && entry.length <= 64)
      .slice(0, 50),
    leaderboardVisible: oneOf(source.leaderboardVisible, ['academy', 'group', 'off'] as const, 'academy'),
    leaderboard,
    pages,
    mobileAppName: asText(source.mobileAppName, 40),
    mobileIconUrl: asText(source.mobileIconUrl, 400),
    splashColor: /^#[0-9a-fA-F]{6}$/.test(String(source.splashColor ?? '')) ? String(source.splashColor) : '',
    iosBundleId: asText(source.iosBundleId, 120),
    androidPackage: asText(source.androidPackage, 120),
    mobileSubtitle: asText(source.mobileSubtitle, 80),
  };
}

export function roleCan(settings: AcademySettings, role: AcademyRole, permission: AcademyPermission): boolean {
  if (role === 'institution_admin') return true;
  return settings.roleGrants[role]?.includes(permission) ?? false;
}

export function signupDecision(input: {
  policy?: SignupPolicy | null;
  domains?: readonly string[];
  email: string;
}): { ok: true } | { ok: false; reason: string } {
  const policy = input.policy ?? 'open';
  if (policy === 'invite') {
    return { ok: false, reason: 'This academy adds people by invitation. Use the join link from your administrator.' };
  }
  if (policy === 'domain') {
    const host = input.email.trim().toLowerCase().split('@')[1] ?? '';
    const allowed = (input.domains ?? []).map((domain) => domain.trim().toLowerCase());
    if (!host || !allowed.includes(host)) {
      return { ok: false, reason: 'Use an email address on this academy’s allowed domain.' };
    }
  }
  return { ok: true };
}

export function passwordAccepts(
  password: string,
  policy: { minLength?: number; requireSymbol?: boolean },
): string | null {
  const min = policy.minLength && policy.minLength > 0 ? policy.minLength : 8;
  if (password.length < min) return `Use at least ${min} characters.`;
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) return 'Include a symbol in the password.';
  return null;
}

/** An empty allowlist allows every address. A missing IP does not lock the session. */
export function ipAllowed(allowlist: readonly string[], ip: string): boolean {
  const rules = allowlist.map((entry) => entry.trim()).filter(Boolean);
  if (!rules.length) return true;
  const target = ip.trim();
  if (!target) return true;
  return rules.some((rule) => (rule.endsWith('*') ? target.startsWith(rule.slice(0, -1)) : rule === target));
}

export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? '';
  return headers.get('x-real-ip')?.trim() ?? '';
}

export function rankLeaderboard(rows: readonly LeaderboardRow[]): { rank: number; name: string; points: number }[] {
  return [...rows]
    .filter((row) => row.name.trim())
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((row, index) => ({ rank: index + 1, name: row.name.trim(), points: Math.max(0, Math.round(row.points)) }));
}

export function fillCertificateTemplate(
  body: string,
  values: { name: string; course: string; issuer: string },
): string {
  return body
    .replaceAll('{{name}}', values.name)
    .replaceAll('{{course}}', values.course)
    .replaceAll('{{issuer}}', values.issuer);
}

export function academyTaxRate(input: {
  mode: AcademySettings['taxMode'];
  customRate: number;
  country: string;
  currency: string;
}): number {
  if (input.mode === 'exempt') return 0;
  if (input.mode === 'custom') return Math.min(0.3, Math.max(0, input.customRate));
  return taxRateFor('course', input.country, input.currency);
}

export function publicTenantPatch(settings: AcademySettings) {
  const showBoard = settings.features.leaderboard && settings.leaderboardVisible !== 'off';
  return {
    signupPolicy: settings.signupPolicy,
    allowedEmailDomains: settings.allowedEmailDomains,
    catalogueVisibility: settings.catalogueVisibility,
    defaultLocale: settings.defaultLocale,
    require2fa: settings.require2fa,
    passwordMinLength: settings.passwordMinLength,
    passwordRequireSymbol: settings.passwordRequireSymbol,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    features: settings.features,
    leaderboardVisible: settings.leaderboardVisible,
    leaderboard: showBoard ? rankLeaderboard(settings.leaderboard) : [],
    publishedPages: settings.features.customPages
      ? settings.pages.filter((page) => page.published).map((page) => ({ slug: page.slug, title: page.title, body: page.body }))
      : [],
  };
}

/** Production cannot skip the allowlist when the Admin SDK cannot verify it. */
export function academyAccessWithoutSdk(nodeEnv: string | undefined): {
  status: 200 | 503;
  body: { enforced: boolean; allowed: boolean; error?: string; code?: 'ADMIN_NOT_CONFIGURED' };
} {
  if (nodeEnv === 'production') {
    return {
      status: 503,
      body: {
        enforced: true,
        allowed: false,
        error: 'Academy access cannot be verified.',
        code: 'ADMIN_NOT_CONFIGURED',
      },
    };
  }
  return { status: 200, body: { enforced: false, allowed: true } };
}

export function privacyExport(input: {
  exportedAt: string;
  institutionName: string;
  profile: unknown;
  members: unknown;
  catalogue: unknown;
  audit: unknown;
  settings: AcademySettings;
}): Record<string, unknown> {
  return {
    product: 'Poket School',
    exportedAt: input.exportedAt,
    institution: input.institutionName,
    profile: input.profile,
    members: input.members,
    catalogue: input.catalogue,
    audit: input.audit,
    settings: input.settings,
    notice: 'Personal data held for this academy. Retention follows the academy privacy setting.',
  };
}
