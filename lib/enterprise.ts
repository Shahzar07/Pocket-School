/**
 * Enterprise academy decisions: plans, people, catalogue, compliance, and
 * white-label limits. Firestore writes stay in lib/institution-store.ts.
 * OEM seat maths stay in lib/oem.ts.
 */

import { namedLevel, parseGender } from './insights/census';
import { isFlagEnabled } from './payments/flags';

export const INSTITUTION_TYPES = [
  'school',
  'college',
  'university',
  'corporate',
  'government',
  'international_school',
  'tuition_centre',
  'homeschool_group',
  'training_provider',
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const INSTITUTION_PLANS = ['starter', 'team', 'enterprise', 'oem'] as const;
export type InstitutionPlan = (typeof INSTITUTION_PLANS)[number];

export const INSTITUTION_STATUSES = ['active', 'pending', 'suspended'] as const;
export type InstitutionStatus = (typeof INSTITUTION_STATUSES)[number];

export const ACADEMY_ROLES = ['institution_admin', 'manager', 'teacher', 'learner', 'parent'] as const;
export type AcademyRole = (typeof ACADEMY_ROLES)[number];

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'demo', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const GROUP_KINDS = ['campus', 'department', 'class', 'group'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const BRAND_FONTS = [
  { id: 'system', label: 'System sans', stack: 'ui-sans-serif, system-ui, sans-serif' },
  { id: 'serif', label: 'Serif', stack: 'Georgia, "Iowan Old Style", Palatino, serif' },
  { id: 'rounded', label: 'Rounded', stack: '"Avenir Next", "Segoe UI", sans-serif' },
  { id: 'mono', label: 'Mono', stack: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
] as const;

export type BrandFontId = (typeof BRAND_FONTS)[number]['id'];

export function brandFontStack(id: string | null | undefined): string | null {
  return BRAND_FONTS.find((font) => font.id === id)?.stack ?? null;
}

/** Starter and team academies keep the Poket School mark. Enterprise and OEM may hide it. */
export function canHidePoweredBy(plan: string | null | undefined): boolean {
  return plan === 'enterprise' || plan === 'oem';
}

export function canUseCustomDomain(plan: string | null | undefined): boolean {
  return canHidePoweredBy(plan);
}

export interface TenantActor {
  superAdmin: boolean;
  institutionId?: string | null;
}

/** Super admins see every tenant. An institution admin sees only their own. */
export function tenantVisible(actor: TenantActor, institutionId: string): boolean {
  if (actor.superAdmin) return true;
  return !!actor.institutionId && actor.institutionId === institutionId;
}

export interface InstitutionAddress {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
}

export interface InstitutionContact {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface InstitutionProfile {
  type: InstitutionType;
  country: string;
  /** Subdivision shown in the self-join dropdown. */
  state: string;
  /** Super admin turns this on before the academy appears in signup. */
  listedForSelfJoin: boolean;
  plan: InstitutionPlan;
  address: InstitutionAddress;
  contacts: InstitutionContact[];
  billingEmail: string;
  poNumber: string;
  seatCount: number;
  seatsUsed: number;
  licenceStartsOn: string;
  licenceEndsOn: string;
  renewalOn: string;
  amount: number;
  currency: string;
  parentInstitutionId: string;
  isolateData: boolean;
}

export function blankProfile(partial: Partial<InstitutionProfile> = {}): InstitutionProfile {
  return {
    type: 'school',
    country: '',
    state: '',
    listedForSelfJoin: false,
    plan: 'team',
    billingEmail: '',
    poNumber: '',
    seatCount: 0,
    seatsUsed: 0,
    licenceStartsOn: '',
    licenceEndsOn: '',
    renewalOn: '',
    amount: 0,
    currency: 'USD',
    parentInstitutionId: '',
    isolateData: false,
    ...partial,
    address: { line1: '', line2: '', city: '', region: '', postalCode: '', ...partial.address },
    contacts: partial.contacts ?? [],
  };
}

export interface DirectoryRow {
  id: string;
  name: string;
  status: InstitutionStatus;
  domain: string;
  subdomain: string;
  customDomain: string;
  profile: InstitutionProfile;
}

export interface DirectoryFilter {
  query?: string;
  status?: InstitutionStatus | 'all';
  type?: InstitutionType | 'all';
  plan?: InstitutionPlan | 'all';
  country?: string;
}

export function filterDirectory(rows: readonly DirectoryRow[], filter: DirectoryFilter): DirectoryRow[] {
  const needle = filter.query?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (filter.status && filter.status !== 'all' && row.status !== filter.status) return false;
    if (filter.type && filter.type !== 'all' && row.profile.type !== filter.type) return false;
    if (filter.plan && filter.plan !== 'all' && row.profile.plan !== filter.plan) return false;
    if (filter.country && row.profile.country !== filter.country) return false;
    if (!needle) return true;
    const contacts = row.profile.contacts.map((contact) => `${contact.name} ${contact.email}`).join(' ');
    const haystack = [
      row.name, row.domain, row.subdomain, row.customDomain, row.profile.country,
      row.profile.plan, row.profile.type, row.profile.billingEmail, contacts,
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

export function institutionsToCsv(rows: readonly DirectoryRow[]): string {
  const header = ['name', 'type', 'country', 'plan', 'status', 'seats', 'seatsUsed', 'domain', 'subdomain', 'customDomain', 'renewal', 'state', 'listed'];
  const lines = rows.map((row) => [
    row.name,
    row.profile.type,
    row.profile.country,
    row.profile.plan,
    row.status,
    String(row.profile.seatCount),
    String(row.profile.seatsUsed),
    row.domain,
    row.subdomain,
    row.customDomain,
    row.profile.renewalOn,
    row.profile.state,
    row.profile.listedForSelfJoin ? 'yes' : 'no',
  ].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\n');
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function seatUtilisation(seatsUsed: number, seats: number): number {
  if (seats <= 0) return 0;
  return Math.min(1, Math.max(0, seatsUsed / seats));
}

export type RenewalState = 'none' | 'ok' | 'soon' | 'due' | 'lapsed';

export function renewalState(renewalOn: string, today: string): RenewalState {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(renewalOn) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return 'none';
  if (today > renewalOn) return 'lapsed';
  if (today === renewalOn) return 'due';
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${renewalOn}T00:00:00Z`);
  const days = Math.round((end - start) / 86_400_000);
  return days <= 45 ? 'soon' : 'ok';
}

export type ComplianceState = 'ok' | 'remind' | 'due' | 'overdue';

export function complianceState(dueOn: string, remindDays: number, today: string): ComplianceState {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return 'ok';
  if (today > dueOn) return 'overdue';
  if (today === dueOn) return 'due';
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${dueOn}T00:00:00Z`);
  const days = Math.round((end - start) / 86_400_000);
  return days <= Math.max(0, remindDays) ? 'remind' : 'ok';
}

export interface AnalyticsInput {
  seats: number;
  seatsUsed: number;
  members: number;
  activeMembers: number;
  completions: number;
  assigned: number;
  skills: Record<string, number>;
}

export interface AnalyticsRollup {
  seatUtilisation: number;
  engagement: number;
  completionRate: number;
  skills: { name: string; count: number }[];
}

export function rollupAnalytics(input: AnalyticsInput): AnalyticsRollup {
  const engagement = input.members <= 0 ? 0 : Math.min(1, input.activeMembers / input.members);
  const completionRate = input.assigned <= 0 ? 0 : Math.min(1, input.completions / input.assigned);
  const skills = Object.entries(input.skills)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    seatUtilisation: seatUtilisation(input.seatsUsed, input.seats),
    engagement,
    completionRate,
    skills,
  };
}

export function analyticsToCsv(rollup: AnalyticsRollup): string {
  const lines = [
    'metric,value',
    `seatUtilisation,${rollup.seatUtilisation.toFixed(4)}`,
    `engagement,${rollup.engagement.toFixed(4)}`,
    `completionRate,${rollup.completionRate.toFixed(4)}`,
    ...rollup.skills.map((skill) => `skill:${csvCell(skill.name)},${skill.count}`),
  ];
  return lines.join('\n');
}

/** Platform role stored on the user profile. Manager keeps a teacher login. */
export function platformRoleForAcademy(role: AcademyRole): 'institution_admin' | 'teacher' | 'student' | 'parent' {
  if (role === 'institution_admin') return 'institution_admin';
  if (role === 'parent') return 'parent';
  if (role === 'learner') return 'student';
  return 'teacher';
}

export interface MemberRow {
  email: string;
  name: string;
  academyRole: AcademyRole;
  gender?: 'male' | 'female';
  level?: string;
  country?: string;
  state?: string;
  dateOfBirth?: string;
}

export interface MemberParse {
  rows: MemberRow[];
  errors: string[];
}

const ROLE_ALIASES: Record<string, AcademyRole> = {
  'institution admin': 'institution_admin',
  institution_admin: 'institution_admin',
  admin: 'institution_admin',
  manager: 'manager',
  teacher: 'teacher',
  learner: 'learner',
  student: 'learner',
  parent: 'parent',
};

const MEMBER_COLUMNS = ['email', 'name', 'role', 'gender', 'level', 'country', 'state', 'dateofbirth'];

function columnKey(cell: string): string {
  return cell.toLowerCase().replace(/[^a-z]/g, '');
}

/** CSV header `email,name,role`. Optional columns: gender, level, country, state, dateOfBirth. */
export function parseMemberCsv(text: string): MemberParse {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: MemberRow[] = [];
  const errors: string[] = [];
  let columns = MEMBER_COLUMNS;
  lines.forEach((line, index) => {
    const cells = splitCsvLine(line).map((cell) => cell.trim());
    const first = cells[0] ?? '';
    if (index === 0 && /^e-?mail$/i.test(columnKey(first)) && !first.includes('@')) {
      const named = cells.map(columnKey);
      if (named.includes('email')) columns = named;
      return;
    }
    const at = (key: string, position: number) => {
      const named = columns.indexOf(key);
      if (named >= 0) return cells[named] ?? '';
      if (!columns.includes('gender') && cells.length > position) return cells[position] ?? '';
      return '';
    };
    const email = at('email', 0).toLowerCase();
    const nameRaw = at('name', 1);
    const roleRaw = at('role', 2);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Line ${index + 1} needs an email address.`);
      return;
    }
    const academyRole = ROLE_ALIASES[roleRaw.toLowerCase()] ?? (roleRaw === '' ? 'learner' : null);
    if (!academyRole) {
      errors.push(`Line ${index + 1}: role must be institution admin, manager, teacher, learner, or parent.`);
      return;
    }
    const genderRaw = at('gender', 3);
    const gender = genderRaw ? parseGender(genderRaw) : '';
    if (genderRaw && !gender) {
      errors.push(`Line ${index + 1}: gender must be male or female.`);
      return;
    }
    const levelRaw = at('level', 4);
    const level = levelRaw ? namedLevel(levelRaw) : '';
    if (levelRaw && !level) {
      errors.push(`Line ${index + 1}: level must be a level name, not a year number.`);
      return;
    }
    const country = at('country', 5).toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) {
      errors.push(`Line ${index + 1}: country must be a two-letter code.`);
      return;
    }
    const dob = at('dateofbirth', 7);
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      errors.push(`Line ${index + 1}: date of birth must be YYYY-MM-DD.`);
      return;
    }
    const state = at('state', 6).slice(0, 80);
    rows.push({
      email,
      name: nameRaw || email,
      academyRole,
      ...(gender ? { gender } : {}),
      ...(level ? { level } : {}),
      ...(country ? { country } : {}),
      ...(state ? { state } : {}),
      ...(dob ? { dateOfBirth: dob } : {}),
    });
  });
  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export interface LeadDraft {
  name: string;
  email: string;
  organisation: string;
  country: string;
  type: InstitutionType;
  seats: number;
  message: string;
}

export function leadDraftError(draft: LeadDraft): string | null {
  if (draft.name.trim().length < 2) return 'Add your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return 'Add a work email.';
  if (draft.organisation.trim().length < 2) return 'Add the organisation.';
  if (!/^[A-Za-z]{2}$/.test(draft.country.trim())) return 'Choose a country.';
  if (!INSTITUTION_TYPES.includes(draft.type)) return 'Choose an organisation type.';
  if (!Number.isInteger(draft.seats) || draft.seats < 1 || draft.seats > 100000) return 'Seat count needs to be between 1 and 100000.';
  if (draft.message.trim().length > 2000) return 'Keep the note under 2000 characters.';
  return null;
}

export const SKILL_FRAMEWORK: readonly { domain: string; name: string; level: string }[] = [
  { domain: 'Communication', name: 'Explain a topic clearly', level: 'practised' },
  { domain: 'Numeracy', name: 'Reason with quantities', level: 'practised' },
  { domain: 'Digital fluency', name: 'Use digital tools with care', level: 'introduced' },
  { domain: 'Compliance', name: 'Follow a required procedure', level: 'assessed' },
  { domain: 'Leadership', name: 'Guide a group task', level: 'introduced' },
  { domain: 'Subject mastery', name: 'Apply a subject idea to a new case', level: 'practised' },
];

/** Keys the academy needs before SSO, SCIM, LTI, or meetings leave invite-only mode. */
export const INTEGRATION_ENV = {
  saml: ['SAML_ENTRY_POINT', 'SAML_ISSUER', 'SAML_CERT'],
  oidc: ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'],
  scim: ['SCIM_BEARER_TOKEN'],
  lti: ['LTI_CLIENT_ID', 'LTI_DEPLOYMENT_ID', 'LTI_PRIVATE_KEY'],
  zoom: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
  teams: ['TEAMS_CLIENT_ID', 'TEAMS_CLIENT_SECRET', 'TEAMS_TENANT_ID'],
} as const;

export interface IdentityMode {
  saml: boolean;
  oidc: boolean;
  scim: boolean;
  lti: boolean;
  zoom: boolean;
  teams: boolean;
  mode: 'sso' | 'invite-only';
}

function filled(env: Record<string, string | undefined>, names: readonly string[]): boolean {
  return names.every((name) => Boolean(env[name]?.trim()));
}

/**
 * Without the platform keys, sign-in stays on email and join links.
 * Flags that are forced off also keep the connector dark.
 */
export function identityMode(
  env: Record<string, string | undefined>,
  flagEnv?: string | null,
): IdentityMode {
  const saml = filled(env, INTEGRATION_ENV.saml) && isFlagEnabled('integrations.saml', null, flagEnv);
  const oidc = filled(env, INTEGRATION_ENV.oidc) && isFlagEnabled('integrations.saml', null, flagEnv);
  const scim = filled(env, INTEGRATION_ENV.scim);
  const lti = filled(env, INTEGRATION_ENV.lti) && isFlagEnabled('integrations.lti', null, flagEnv);
  const zoom = filled(env, INTEGRATION_ENV.zoom) && isFlagEnabled('integrations.zoom', null, flagEnv);
  const teams = filled(env, INTEGRATION_ENV.teams) && isFlagEnabled('integrations.teams', null, flagEnv);
  return {
    saml,
    oidc,
    scim,
    lti,
    zoom,
    teams,
    mode: saml || oidc ? 'sso' : 'invite-only',
  };
}

export function makeSecretToken(prefix: string, random: () => number = Math.random): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let body = '';
  for (let i = 0; i < 24; i += 1) body += alphabet[Math.floor(random() * alphabet.length) % alphabet.length];
  return `${prefix}_${body}`;
}

export async function digestSecret(secret: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(buf), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function secretPrefix(secret: string): string {
  return secret.slice(0, 10);
}

export interface AuditEvent {
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  detail?: string;
  at: string;
}
