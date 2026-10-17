/**
 * Official LinkedIn links for a verified Poket School record.
 * Add to Profile and share-offsite need no API approval.
 * Sign-in uses OpenID Connect only when LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are set.
 * A member post stays off unless LinkedIn has approved w_member_social and the flag is on.
 * Nothing here scrapes LinkedIn or submits a job application.
 */

export const LINKEDIN_OIDC_SCOPES = ['openid', 'profile', 'email'] as const;

export const APPLICATION_STATUSES = ['draft', 'applied', 'interview', 'offer', 'hired', 'studying', 'closed'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface LinkedInItem {
  source: 'verified' | 'self_reported';
  kind: string;
  title: string;
  detail: string;
  when: string;
}

export interface LinkedInPack {
  featured: string;
  website: string;
  about: string;
  experience: string;
  education: string;
  text: string;
}

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  link: string;
  status: ApplicationStatus;
  date: string;
  shareToken: string;
  reminderOn: string;
}

export interface ShareView {
  at: string;
  itemTitle: string;
  visitorLabel: string;
}

const EDUCATION_KINDS = new Set(['institution', 'course', 'certificate', 'badge', 'score']);
const STOP_WORDS = new Set([
  'with', 'from', 'this', 'that', 'your', 'have', 'will', 'role', 'team', 'work', 'and', 'the', 'for',
  'you', 'our', 'their', 'about', 'into', 'over', 'under', 'using', 'ability', 'skills', 'skill',
  'experience', 'looking', 'join', 'company', 'able', 'must', 'should', 'would', 'they', 'them',
]);

export function linkedInSignInEnabled(input: { clientId?: string | null; clientSecret?: string | null }): boolean {
  return Boolean((input.clientId ?? '').trim() && (input.clientSecret ?? '').trim());
}

export function linkedInAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId.trim(),
    redirect_uri: input.redirectUri,
    scope: LINKEDIN_OIDC_SCOPES.join(' '),
    state: input.state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function memberShareDecision(input: {
  flag?: string | null;
  hasMemberToken?: boolean;
}): { allowed: false; reason: string } | { allowed: true; reason: string } {
  if ((input.flag ?? '').trim().toLowerCase() !== 'on') {
    return {
      allowed: false,
      reason: 'Share to LinkedIn uses the public share link. A member post stays off until LinkedIn approves w_member_social and LINKEDIN_MEMBER_SHARE is on.',
    };
  }
  if (!input.hasMemberToken) {
    return {
      allowed: false,
      reason: 'A member post needs a LinkedIn token that includes w_member_social. Sign-in uses OpenID only, so this stays off.',
    };
  }
  return { allowed: true, reason: 'A member post can be sent with the approved Share API.' };
}

export function portfolioLinks(studentNumber: string): { featured: string; website: string; qr: string } {
  const number = studentNumber.trim().toUpperCase();
  const url = number ? `https://poketschool.ai/portfolio/${encodeURIComponent(number)}` : '';
  return { featured: url, website: url, qr: url };
}

function sourceLabel(source: LinkedInItem['source']): string {
  return source === 'verified' ? 'Verified by Poket School' : 'Self-reported';
}

function itemLine(item: LinkedInItem): string {
  const when = item.when ? ` (${item.when})` : '';
  const detail = item.detail ? ` — ${item.detail}` : '';
  return `${item.title}${detail}${when} [${sourceLabel(item.source)}]`;
}

export function linkedInPack(input: {
  name: string;
  studentNumber: string;
  items: readonly LinkedInItem[];
}): LinkedInPack {
  const links = portfolioLinks(input.studentNumber);
  const name = input.name.trim() || 'Learner';
  const education = input.items.filter((item) => EDUCATION_KINDS.has(item.kind));
  const experience = input.items.filter((item) => !EDUCATION_KINDS.has(item.kind));
  const verified = input.items.filter((item) => item.source === 'verified');
  const about = [
    `${name}. Student number ${input.studentNumber.trim().toUpperCase() || 'follows this account'}.`,
    verified.length
      ? `${verified.length} achievement${verified.length === 1 ? '' : 's'} verified by Poket School.`
      : 'Verified achievements appear here once Poket School records them.',
    links.website ? `Portfolio: ${links.website}` : '',
  ].filter(Boolean).join(' ');
  const experienceText = experience.length ? experience.map(itemLine).join('\n') : 'Nothing in this section yet.';
  const educationText = education.length ? education.map(itemLine).join('\n') : 'Nothing in this section yet.';
  const text = [
    'Featured',
    links.featured || 'Add a student number to publish the portfolio link.',
    '',
    'Contact info website',
    links.website || 'Add a student number to publish the portfolio link.',
    '',
    'About',
    about,
    '',
    'Experience',
    experienceText,
    '',
    'Education',
    educationText,
  ].join('\n');
  return {
    featured: links.featured,
    website: links.website,
    about,
    experience: experienceText,
    education: educationText,
    text,
  };
}

export function shareTokenFrom(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isShareToken(value: string): boolean {
  return /^[a-f0-9]{32,64}$/.test(value);
}

export function readShareLabel(value: unknown): { label: string } | { error: string } {
  const label = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  if (label.length < 2) return { error: 'Name this link, for example Company X - Analyst.' };
  return { label };
}

export function shareExpiresOn(today: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match) return today;
  const span = Math.min(180, Math.max(1, Math.floor(days) || 30));
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + span));
  return date.toISOString().slice(0, 10);
}

export function shareIsOpen(input: { expiresOn: string; revoked: boolean; today: string }): boolean {
  if (input.revoked) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn) || !/^\d{4}-\d{2}-\d{2}$/.test(input.today)) return false;
  return input.today <= input.expiresOn;
}

export function readVisitorLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function viewTracker(views: readonly ShareView[]): {
  total: number;
  latest: string;
  items: { title: string; count: number }[];
} {
  const counts = new Map<string, number>();
  let latest = '';
  for (const view of views) {
    const title = view.itemTitle.replace(/\s+/g, ' ').trim() || 'Verified record';
    counts.set(title, (counts.get(title) ?? 0) + 1);
    if (view.at > latest) latest = view.at;
  }
  const items = [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return { total: views.length, latest, items };
}

export function canConfirmVerification(role: 'learner' | 'school' | 'employer'): boolean {
  return role === 'learner' || role === 'school';
}

function readDate(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : '';
}

export function readApplication(input: {
  id?: unknown;
  company: unknown;
  role: unknown;
  link: unknown;
  status: unknown;
  date: unknown;
  shareToken?: unknown;
  reminderOn?: unknown;
}): JobApplication | { error: string } {
  const company = typeof input.company === 'string' ? input.company.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const role = typeof input.role === 'string' ? input.role.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  if (company.length < 2) return { error: 'Add the company.' };
  if (role.length < 2) return { error: 'Add the role.' };
  const link = typeof input.link === 'string' ? input.link.trim() : '';
  if (link && (!/^https:\/\//i.test(link) || link.length > 300)) return { error: 'Use an https link for the job posting.' };
  const status = typeof input.status === 'string' ? input.status : 'applied';
  if (!APPLICATION_STATUSES.includes(status as ApplicationStatus)) return { error: 'Choose a status.' };
  const date = readDate(input.date);
  if (!date) return { error: 'Add the date you applied.' };
  const shareToken = typeof input.shareToken === 'string' ? input.shareToken.trim() : '';
  if (shareToken && !isShareToken(shareToken)) return { error: 'Choose a share link from this portfolio.' };
  const id = typeof input.id === 'string' && /^[a-f0-9]{16,40}$/.test(input.id) ? input.id : '';
  return {
    id,
    company,
    role,
    link,
    status: status as ApplicationStatus,
    date,
    shareToken,
    reminderOn: readDate(input.reminderOn),
  };
}

export function reminderDue(input: { status: string; reminderOn: string; today: string }): boolean {
  if (input.status !== 'applied' && input.status !== 'interview') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reminderOn) || !/^\d{4}-\d{2}-\d{2}$/.test(input.today)) return false;
  return input.reminderOn <= input.today;
}

function jobWords(text: string): string[] {
  const found = text.toLowerCase().match(/[a-z][a-z0-9+]{3,}/g) ?? [];
  return [...new Set(found.filter((word) => !STOP_WORDS.has(word)))];
}

/** Restates verified achievements that already contain the job's words. */
export function tailorBullets(input: {
  jobText: string;
  items: readonly { title: string; detail: string; source: 'verified' | 'self_reported' }[];
}): { bullets: string[]; invented: false; fromRecord: true } {
  const keys = jobWords(input.jobText);
  const bullets: string[] = [];
  for (const item of input.items) {
    if (item.source !== 'verified') continue;
    const title = item.title.replace(/\s+/g, ' ').trim();
    const detail = item.detail.replace(/\s+/g, ' ').trim();
    const hay = `${title} ${detail}`.toLowerCase();
    if (!title || !keys.some((key) => hay.includes(key))) continue;
    bullets.push(detail ? `${title} — ${detail}` : title);
  }
  return { bullets: bullets.slice(0, 8), invented: false, fromRecord: true };
}
