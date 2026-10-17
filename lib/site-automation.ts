/**
 * Self-serve rules for the whole site. A super admin can turn any rule off.
 * Off sends that step back to a person. The feed records what the rule did.
 */

import { moderateText } from './community/moderation';

export const ANNUAL_REFUND_DAYS = 14;
export const COURSE_REFUND_DAYS = 14;

export const AUTOMATION_RULES = [
  { id: 'student_signup', journey: 'Student signup', label: 'Open a student account from the signup form', defaultOn: true, wasManual: 'No', automated: 'The form and email code open the account.', remaining: 'A super admin can still suspend the account.', offMeans: 'Signup waits for a super admin.' },
  { id: 'student_upgrade', journey: 'Student upgrade', label: 'Change plan at checkout', defaultOn: true, wasManual: 'No', automated: 'Checkout starts the new plan.', remaining: 'A custom price still needs a super admin.', offMeans: 'Plan changes wait for a super admin.' },
  { id: 'student_cancel', journey: 'Student cancel', label: 'Cancel a student plan at the period end', defaultOn: true, wasManual: 'Partly', automated: 'Billing schedules the end of the period.', remaining: 'Ending a plan today stays with a super admin.', offMeans: 'Cancellation waits for a super admin.' },
  { id: 'student_refund', journey: 'Student refund', label: 'Refund a student payment inside the policy', defaultOn: true, wasManual: 'Yes', automated: 'An annual plan inside 14 days is pro-rated. A course inside 14 days is refunded. Monthly plans and Sparks packs are refused by the policy.', remaining: 'Outside that window, academy invoices, and a payment with no provider record stay with a super admin.', offMeans: 'Every refund waits for a super admin.' },
  { id: 'parent_signup', journey: 'Parent signup', label: 'Open a parent account from the signup form', defaultOn: true, wasManual: 'No', automated: 'The form opens the account.', remaining: 'None.', offMeans: 'Parent signup waits for a super admin.' },
  { id: 'parent_link', journey: 'Parent link', label: 'Link a parent with the student code or QR', defaultOn: true, wasManual: 'No', automated: 'The code or QR links the parent. Age 13 and over confirms on the existing link.', remaining: 'Under 13 still needs the institution admin, so a child is not linked by a scan alone.', offMeans: 'Every parent link waits for an admin.' },
  { id: 'teacher_signup', journey: 'Teacher signup', label: 'Open an individual teacher account', defaultOn: true, wasManual: 'No', automated: 'The form opens the account.', remaining: 'None.', offMeans: 'Teacher signup waits for a super admin.' },
  { id: 'teacher_library', journey: 'Course in the institution library', label: 'Publish a teacher course to the institution library after the content check', defaultOn: true, wasManual: 'Yes', automated: 'A course that passes the content and brand rules goes into the institution library.', remaining: 'A failed check waits until the teacher fixes it or an admin overrides it. Turning this off returns the queue to the institution admin.', offMeans: 'The institution admin approves every course.' },
  { id: 'marketplace_listing', journey: 'Marketplace listing', label: 'List a teacher course on the public marketplace', defaultOn: false, wasManual: 'Yes', automated: 'When this is on, a course that passed the content check is listed publicly.', remaining: 'The public marketplace stays with a super admin unless this is turned on.', offMeans: 'A super admin approves each public listing.' },
  { id: 'institution_signup', journey: 'Institution signup', label: 'Register an academy without a super admin', defaultOn: true, wasManual: 'Yes', automated: 'Account, organisation, plan, and checkout open the academy.', remaining: 'Manual approval mode and the review rules can still hold it.', offMeans: 'Every academy waits for a super admin.' },
  { id: 'institution_activation', journey: 'Institution activation', label: 'Activate an academy when payment or a trial succeeds', defaultOn: true, wasManual: 'Yes', automated: 'Payment or a trial provisions seats, Sparks, courses, and the login draft.', remaining: 'Suspend, refund, and edit stay with a super admin.', offMeans: 'Payment is recorded and a super admin activates the academy.' },
  { id: 'institution_seats', journey: 'Institution seat changes', label: 'Add or remove seats with proration', defaultOn: true, wasManual: 'Partly', automated: 'The billing page prices the days left.', remaining: 'A super admin can still edit the bill.', offMeans: 'Seat changes wait for a super admin.' },
  { id: 'tier_upgrade', journey: 'Institution tier', label: 'Move an academy up a tier when the student count grows', defaultOn: true, wasManual: 'Yes', automated: 'A higher student count moves the academy to the next tier. The difference is prorated and the admin is notified. A lower count is suggested at renewal.', remaining: 'A super admin can still edit the tier.', offMeans: 'A tier change waits for a super admin.' },
  { id: 'institution_join', journey: 'Institution join', label: 'Approve students and parents from the academy rules', defaultOn: true, wasManual: 'Yes', automated: 'A matching domain, class code, or roster row opens the account. A full level waits for a seat or adds one. Under 13 still needs a parent.', remaining: 'The approval queue stays for everyone else. The welcome course enrols with a badge.', offMeans: 'Every join waits in the approval queue.' },
  { id: 'alumni_rollover', journey: 'Alumni', label: 'Graduate to alumni, free the seat, and open an individual account', defaultOn: true, wasManual: 'Yes', automated: 'Graduation moves that academy’s courses to Completed, frees the used seat immediately, and reviews the tier. The account becomes individual. Profile, student number, certificates, badges, transcript, and progress stay. Grace days default to 0 and can keep course review only. Final-level students are suggested, the seats and bill are previewed, and an admin confirms. Undo within 7 days restores the seat and access.', remaining: 'An admin can still mark someone, and certificates stay on the account.', offMeans: 'End dates wait for an admin. A marked leaver still keeps the record.' },
  { id: 'learner_record', journey: 'Lifelong record', label: 'Keep one student number across academies and build the portfolio', defaultOn: true, wasManual: 'Yes', automated: 'Joining another academy keeps the student number and the earlier history. The portfolio fills from verified records. A destination is recorded only with consent.', remaining: 'The learner reviews ET AI wording and turns sharing on. Under 18 needs a parent for a public portfolio.', offMeans: 'History still stays on the account. Sharing and destination detection wait.' },
  { id: 'institution_cancel', journey: 'Institution cancel', label: 'Cancel an academy at the period end', defaultOn: true, wasManual: 'Partly', automated: 'The academy stays open until the period ends.', remaining: 'Suspending today stays with a super admin.', offMeans: 'Cancellation waits for a super admin.' },
  { id: 'sparks_topup', journey: 'Sparks top-up', label: 'Buy Sparks packs at checkout', defaultOn: true, wasManual: 'No', automated: 'Checkout adds the pack.', remaining: 'Sparks packs are not refunded.', offMeans: 'A super admin adds Sparks.' },
  { id: 'plan_proration', journey: 'Plan change proration', label: 'Prorate institution plan changes', defaultOn: true, wasManual: 'Partly', automated: 'A plan or interval change is priced for the days left.', remaining: 'A student plan starts a new checkout. A custom price needs a super admin.', offMeans: 'Plan changes are quoted by a super admin.' },
  { id: 'invoice_download', journey: 'Invoices and receipts', label: 'Download invoices and receipts', defaultOn: true, wasManual: 'No', automated: 'Billing offers the download.', remaining: 'Writing a manual invoice stays with finance.', offMeans: 'Receipts are sent by finance.' },
  { id: 'password_reset', journey: 'Password reset', label: 'Email a password reset link', defaultOn: true, wasManual: 'No', automated: 'Forgot password sends the link.', remaining: 'None.', offMeans: 'A super admin sends the reset.' },
  { id: 'email_change', journey: 'Email change', label: 'Confirm an email change from the account', defaultOn: true, wasManual: 'No', automated: 'The new inbox confirms the link.', remaining: 'None.', offMeans: 'A super admin changes the email.' },
  { id: 'account_deletion', journey: 'Account deletion', label: 'Schedule account deletion', defaultOn: true, wasManual: 'No', automated: 'The account closes after 14 days unless the person cancels.', remaining: 'A super admin can still close an account for abuse.', offMeans: 'Deletion waits for a super admin.' },
  { id: 'data_export', journey: 'Data export', label: 'Download a copy of the account', defaultOn: true, wasManual: 'No', automated: 'The account page downloads the JSON copy.', remaining: 'None. This is the PDPA and GDPR export.', offMeans: 'A super admin prepares the export.' },
  { id: 'certificate_issue', journey: 'Certificate issue', label: 'Issue a certificate when the module is complete', defaultOn: true, wasManual: 'No', automated: 'Completion issues the certificate, including the student number.', remaining: 'Revoking a certificate stays with a super admin.', offMeans: 'A super admin issues certificates.' },
  { id: 'certificate_verify', journey: 'Public certificate check', label: 'Show a public verification page', defaultOn: true, wasManual: 'No', automated: 'The QR opens the student number, name, course, and issue date.', remaining: 'None.', offMeans: 'Verification waits for a super admin.' },
  { id: 'help_faq', journey: 'Help centre', label: 'Answer common questions from the help centre', defaultOn: true, wasManual: 'Partly', automated: 'The help page answers a matched question.', remaining: 'A question with no match opens a ticket.', offMeans: 'Every question opens a ticket.' },
  { id: 'help_et', journey: 'ET support chat', label: 'Let ET answer before a ticket', defaultOn: true, wasManual: 'Yes', automated: 'ET answers a matched question. A ticket is only the last step.', remaining: 'An unmatched question is a ticket for a person.', offMeans: 'ET does not answer. A ticket opens immediately.' },
] as const;

export type AutomationRuleId = (typeof AUTOMATION_RULES)[number]['id'];
export type AutomationRules = Record<AutomationRuleId, boolean>;

export interface AutomationSettings {
  rules: AutomationRules;
}

export interface AutomationEvent {
  id: string;
  rule: string;
  outcome: 'auto' | 'held' | 'refused' | 'override';
  summary: string;
  at: string;
}

export function defaultAutomation(): AutomationSettings {
  const rules = {} as AutomationRules;
  for (const rule of AUTOMATION_RULES) rules[rule.id] = rule.defaultOn;
  return { rules };
}

export function readAutomation(data: unknown): AutomationSettings {
  const settings = defaultAutomation();
  if (!data || typeof data !== 'object') return settings;
  const raw = (data as { rules?: unknown }).rules;
  if (!raw || typeof raw !== 'object') return settings;
  const source = raw as Record<string, unknown>;
  for (const rule of AUTOMATION_RULES) {
    if (typeof source[rule.id] === 'boolean') settings.rules[rule.id] = source[rule.id] as boolean;
  }
  return settings;
}

export function ruleById(id: string): (typeof AUTOMATION_RULES)[number] | undefined {
  return AUTOMATION_RULES.find((rule) => rule.id === id);
}

export type RefundProduct = 'subscription_month' | 'subscription_year' | 'sparks' | 'course' | 'institution' | 'other';

export function productFromCheckout(kind: string, interval?: string): RefundProduct {
  if (kind === 'sparks') return 'sparks';
  if (kind === 'subscription') return interval === 'year' ? 'subscription_year' : 'subscription_month';
  if (kind === 'course' || kind === 'book' || kind === 'reads' || kind === 'resource') return 'course';
  if (kind === 'invoice') return 'institution';
  return 'other';
}

export function productFromText(text: string, interval?: string): RefundProduct {
  const hay = text.toLowerCase();
  if (hay.includes('spark')) return 'sparks';
  if (hay.includes('purchase order') || hay.includes('institution')) return 'institution';
  if (interval === 'year' || hay.includes('annual') || hay.includes('yearly')) return 'subscription_year';
  if (interval === 'month' || hay.includes('monthly')) return 'subscription_month';
  if (hay.includes('course') || hay.includes('book')) return 'course';
  return 'other';
}

function daysBetween(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86_400_000);
}

export function refundDecision(input: {
  enabled: boolean;
  product: RefundProduct;
  billedOn: string;
  today: string;
  amount: number;
}): { outcome: 'refund' | 'refuse' | 'review'; amount: number; reason: string } {
  if (!input.enabled) return { outcome: 'review', amount: 0, reason: 'Student refunds are set to manual.' };
  if (!(input.amount > 0)) return { outcome: 'refuse', amount: 0, reason: 'There is no amount to refund.' };
  const days = daysBetween(input.billedOn, input.today);
  if (days == null || days < 0) return { outcome: 'review', amount: 0, reason: 'The billing date is missing.' };
  if (input.product === 'sparks') return { outcome: 'refuse', amount: 0, reason: 'Sparks packs stay on the account.' };
  if (input.product === 'institution') return { outcome: 'review', amount: 0, reason: 'An academy invoice or purchase order stays with a super admin.' };
  if (input.product === 'subscription_month') return { outcome: 'refuse', amount: 0, reason: 'A monthly plan is not refunded once the period has started.' };
  if (input.product === 'subscription_year') {
    if (days > ANNUAL_REFUND_DAYS) return { outcome: 'review', amount: 0, reason: 'This is outside the 14-day window for an annual plan.' };
    const unused = Math.max(0, 365 - days) / 365;
    const amount = Math.round(input.amount * unused * 100) / 100;
    return { outcome: 'refund', amount, reason: `Annual plan refunded for the unused days.` };
  }
  if (input.product === 'course') {
    if (days > COURSE_REFUND_DAYS) return { outcome: 'review', amount: 0, reason: 'This course purchase is outside the 14-day window.' };
    return { outcome: 'refund', amount: round2(input.amount), reason: 'Course purchase refunded inside 14 days.' };
  }
  return { outcome: 'review', amount: 0, reason: 'This payment needs a super admin to review.' };
}

/** A policy refund with no payment provider is recorded for a person to send. */
export function settleRefund(input: { outcome: 'refund' | 'refuse' | 'review'; hasProvider: boolean; reason: string }): { outcome: 'refund' | 'refuse' | 'review'; reason: string } {
  if (input.outcome === 'refund' && !input.hasProvider) {
    return { outcome: 'review', reason: `${input.reason} A super admin sends it because this record has no payment provider.` };
  }
  return { outcome: input.outcome, reason: input.reason };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function planCancelOn(today: string, interval: 'month' | 'year'): string | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return { error: 'The date is missing.' };
  const date = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { error: 'The date is missing.' };
  if (interval === 'year') date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function brandRuleCheck(input: { title: string; description: string; level?: string }): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 3) issues.push('Add a course title.');
  if (description.length < 40) issues.push('Add a description of at least a few sentences.');
  const text = `${title}\n${description}\n${input.level ?? ''}`;
  if (/\byear\s*(?:[1-9]|1[0-3])\b/i.test(text)) issues.push('Use a level name. Year numbers are not used on Poket School.');
  if (/\bofficial\s+poket\s+school\b/i.test(text)) issues.push('A teacher course cannot present itself as an official Poket School course.');
  const moderated = moderateText(`${title}\n${description}`.slice(0, 4000) || ' ');
  if (moderated.decision === 'block') issues.push('This text cannot be published.');
  else if (moderated.reasons.includes('off_platform')) issues.push('Keep the course on Poket School.');
  else if (moderated.reasons.includes('harassment')) issues.push('Remove insulting language.');
  return { ok: issues.length === 0, issues };
}

export interface CourseAutomation {
  library: 'approved' | 'pending';
  marketplace: 'hidden' | 'pending' | 'approved';
  status: 'published' | 'pending_approval';
  isPublic: boolean;
  held: boolean;
  note: string;
}

export function courseAutomation(input: {
  libraryAuto: boolean;
  marketplaceAuto: boolean;
  wantsMarketplace: boolean;
  brandOk: boolean;
  issues: string[];
}): CourseAutomation {
  if (!input.brandOk) {
    return {
      library: 'pending',
      marketplace: 'hidden',
      status: 'pending_approval',
      isPublic: false,
      held: true,
      note: input.issues[0] ?? 'The content check held this course.',
    };
  }
  if (!input.libraryAuto) {
    return {
      library: 'pending',
      marketplace: 'hidden',
      status: 'pending_approval',
      isPublic: false,
      held: false,
      note: 'An institution admin approves this course for the library.',
    };
  }
  if (input.wantsMarketplace && input.marketplaceAuto) {
    return {
      library: 'approved',
      marketplace: 'approved',
      status: 'published',
      isPublic: true,
      held: false,
      note: 'In the institution library and on the marketplace.',
    };
  }
  if (input.wantsMarketplace) {
    return {
      library: 'approved',
      marketplace: 'pending',
      status: 'published',
      isPublic: false,
      held: false,
      note: 'In the institution library. The public marketplace waits for a super admin.',
    };
  }
  return {
    library: 'approved',
    marketplace: 'hidden',
    status: 'published',
    isPublic: false,
    held: false,
    note: 'In the institution library.',
  };
}

const FAQ: { id: string; keys: string[]; answer: string }[] = [
  { id: 'password_reset', keys: ['password', 'forgot', 'reset'], answer: 'Open Forgot password on the sign-in page and use the link we email you. You choose the new password yourself.' },
  { id: 'email_change', keys: ['change email', 'new email', 'email address'], answer: 'In your account settings, enter the new email. It changes after you open the link in that inbox.' },
  { id: 'account_deletion', keys: ['delete account', 'close account', 'deletion'], answer: 'Account settings can schedule deletion. Poket School waits 14 days, and you can cancel during that time.' },
  { id: 'data_export', keys: ['export', 'download my data', 'gdpr', 'pdpa', 'my data'], answer: 'Account settings has Download my data. That file is your copy for the PDPA and the GDPR.' },
  { id: 'refund', keys: ['refund', 'money back'], answer: 'An annual plan can be refunded for the unused days within 14 days. A course purchase can be refunded within 14 days. A monthly plan, once started, and a Sparks pack are not refunded. Ask from Billing.' },
  { id: 'parent_link', keys: ['parent', 'qr', 'link my child', 'student number'], answer: 'A parent scans the student QR or enters the PS number. From age 13 the student confirms. Under 13, the institution admin confirms.' },
  { id: 'sparks', keys: ['sparks', 'top up', 'top-up'], answer: 'Sparks are on your Sparks page. A pack is bought at checkout. Packs are not refunded.' },
  { id: 'certificate', keys: ['certificate', 'verify'], answer: 'A certificate is issued when the module is complete. Anyone can open the QR to see the student number, name, course, and issue date.' },
  { id: 'institution', keys: ['institution', 'school signup', 'academy'], answer: 'A school registers at Institutions, chooses a plan, and pays or starts a trial. The setup checklist opens after that.' },
  { id: 'cancel', keys: ['cancel', 'unsubscribe'], answer: 'Billing can cancel at the end of the period. The account stays open until that date.' },
  { id: 'publish', keys: ['publish course', 'marketplace', 'my course'], answer: 'A teacher course that passes the content check goes into the institution library. The public marketplace stays with a super admin unless that rule is turned on.' },
];

export function answerSupport(question: string, settings: AutomationSettings): { matched: boolean; escalate: boolean; topic: string; answer: string } {
  const faqOn = settings.rules.help_faq;
  const etOn = settings.rules.help_et;
  if (!faqOn && !etOn) {
    return { matched: false, escalate: true, topic: '', answer: 'A person on the support team will take this.' };
  }
  const hay = question.toLowerCase();
  const hit = FAQ.find((item) => item.keys.some((key) => hay.includes(key)));
  if (hit && (faqOn || etOn)) {
    return { matched: true, escalate: false, topic: hit.id, answer: hit.answer };
  }
  return { matched: false, escalate: true, topic: '', answer: 'ET could not match that question. A support ticket is the next step.' };
}
