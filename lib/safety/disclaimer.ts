/**
 * Community safety disclaimer. The wording is the draft Harry supplied.
 * [COMPANY LEGAL NAME] and the pending-legal-review marker stay until a lawyer approves a live version.
 */

export const SAFETY_TERMS_VERSION = '2026-10-17';

export const SAFETY_TERMS_TITLE = 'Poket School Community Safety Services: Disclaimer (DRAFT, pending legal review)';

export const PENDING_LEGAL_REVIEW = 'DRAFT, pending legal review';

export const SAFETY_TERMS_STATUS = 'Status: draft, 17 Oct 2026. Not live until Harry approves AND a qualified lawyer (Malaysia + each launch country) reviews it.';

export const COMPANY_LEGAL_NAME = '[COMPANY LEGAL NAME]';

export const UNDER_13_DISCLAIMER = "We help when we can, but we're not the police. If you're scared, call 999 or tell a grown-up now.";

export const SHORT_HEADLINE = 'Not an emergency service. In danger? Call {local emergency number} now.';

export const SHORT_BODY = "Poket School's safety tools are a free community service we provide in good faith. We are a private company, not the police, a school, a counsellor or an emergency service, and we can't guarantee that any alert, report or message will be received, seen or acted on in time.";

export const COMMUNITY_PARTNERS_LINE = "Poket School's safety features are a free community service. We invite community partners to get involved.";

export const FULL_CLAUSES = [
  '2.1 A goodwill community service. [COMPANY LEGAL NAME] ("Poket School", "we") is a private education technology company. We provide our safety features free of charge, voluntarily and in good faith, as a community service. We are not a public authority, law enforcement agency, emergency service, school, child protection agency, medical provider or counselling service, and the safety features do not replace any of them.',
  '2.2 No assumed duty. By offering these features we do not assume, and do not accept, any duty of care, statutory duty, or obligation to monitor, protect, rescue, investigate, intervene or respond, beyond any duty that applicable law requires of us and cannot be excluded. We may change, suspend or stop any safety feature at any time.',
  '2.3 Always contact emergency services first. If you or anyone is in immediate danger, contact your local emergency number (e.g. 999 in Malaysia) or the police directly. Do not rely on Poket School to contact them for you.',
  "2.4 No guarantee of delivery or response. Alerts, reports, push notifications, SMS, emails, maps, locations, police-station listings, emergency numbers and helpline details depend on networks, devices, third parties and information we don't control. They may be delayed, inaccurate, incomplete or not delivered. Safety Desk target response times are goals, not guarantees.",
  '2.5 Amber Alerts. Amber Alerts are published only by verified partners and authorised staff. We do not verify every detail independently and are not responsible for the actions of anyone who receives or acts on an alert. Never approach a suspect; contact the police.',
  "2.6 Anti-bullying, school notices and referrals. We may, with consent or where we believe there is a serious risk, share minimal information with schools, guardians, verified partners or authorities. We do not control how they respond. Evidence locker records are provided for your convenience; we don't guarantee their admissibility.",
  '2.7 ET AI support chat. ET AI is an automated assistant. It is not a counsellor, therapist, doctor or lawyer, and may make mistakes. If you are thinking about harming yourself or someone else, contact a helpline or emergency service immediately.',
  '2.8 Limitation of liability. To the fullest extent permitted by law, Poket School, its directors, staff, volunteers and partners are not liable for any loss, injury or damage arising from use of, reliance on, or inability to use the safety features, including any failure, delay or error. Nothing in these terms excludes or limits liability that cannot be excluded by law (for example, for death or personal injury caused by negligence, fraud, or consumer rights under applicable consumer protection law).',
  '2.9 Your responsibilities. Use safety features honestly. False reports or alerts may lead to account suspension and may be referred to authorities.',
  "2.10 Governing law. Laws of Malaysia, subject to mandatory consumer and child-protection laws of the user's country.",
] as const;

/** These actions stay available with no disclaimer tap and no acknowledgement. */
export const UNGATED_EMERGENCY_ACTIONS = [
  'danger',
  'emergency_number',
  'roll_call_safe',
  'roll_call_need_help',
  'amber_receipt',
] as const;

export type UngatedEmergencyAction = (typeof UNGATED_EMERGENCY_ACTIONS)[number];

const UNGATED = new Set<string>(UNGATED_EMERGENCY_ACTIONS);

export function safetyActionRequiresAck(action: string): boolean {
  return !UNGATED.has(action);
}

export function ackMatchesVersion(storedVersion: string, version = SAFETY_TERMS_VERSION): boolean {
  return storedVersion === version;
}

export function shortHeadline(emergencyNumber: string): string {
  const number = emergencyNumber.trim() || '999';
  return SHORT_HEADLINE.replace('{local emergency number}', number);
}

export function safetyTermsUrl(origin = 'https://poketschool.ai'): string {
  return `${origin.replace(/\/$/, '')}/safety-terms`;
}

export function communityPartnersUrl(origin = 'https://poketschool.ai'): string {
  return `${origin.replace(/\/$/, '')}/community-partners`;
}

export function safetyMessageFooter(emergencyNumber: string, origin = 'https://poketschool.ai'): string {
  return [
    shortHeadline(emergencyNumber),
    SHORT_BODY,
    `Read the full terms: ${safetyTermsUrl(origin)}`,
    COMMUNITY_PARTNERS_LINE,
    `Get involved: ${communityPartnersUrl(origin)}`,
  ].join('\n');
}

export function safetyDeskEmailText(body: string, emergencyNumber = '999', origin = 'https://poketschool.ai'): string {
  return `${body.trim()}\n\n${safetyMessageFooter(emergencyNumber, origin)}`;
}

export function safetyDeskSmsText(body: string, emergencyNumber = '999', origin = 'https://poketschool.ai'): string {
  return `${body.trim()}\n${safetyMessageFooter(emergencyNumber, origin)}`;
}

export function originFromUrl(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return 'https://poketschool.ai';
  }
}
