/**
 * Community partner applications. Submitting a form grants nothing.
 * An admin approval only names the onboarding path. It does not verify the organisation.
 */

export const PARTNER_TYPES = [
  { id: 'police', label: 'Police', route: 'tier4', nextPath: '/signup?partner=tier4' },
  { id: 'child_protection', label: 'Child-protection NGO', route: 'tier4', nextPath: '/signup?partner=tier4' },
  { id: 'school', label: 'School', route: 'institution', nextPath: '/signup?help=school' },
  { id: 'counsellor', label: 'Counsellor or mental-health organisation', route: 'review', nextPath: '/signup?partner=counsellor' },
  { id: 'helpline', label: 'Helpline', route: 'review', nextPath: '/signup?partner=helpline' },
  { id: 'business', label: 'Business or sponsor', route: 'partner_merchant', nextPath: '/signup?partner=merchant' },
  { id: 'volunteer', label: 'Volunteer', route: 'review', nextPath: '/signup?partner=volunteer' },
  { id: 'media', label: 'Media', route: 'review', nextPath: '/signup?partner=media' },
] as const;

export type PartnerTypeId = (typeof PARTNER_TYPES)[number]['id'];

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export interface PartnerApplicationInput {
  orgName: string;
  type: string;
  country: string;
  region: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  message: string;
  companyFax: string;
}

export function emptyPartnerApplication(): PartnerApplicationInput {
  return {
    orgName: '',
    type: 'school',
    country: '',
    region: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    message: '',
    companyFax: '',
  };
}

export function partnerType(id: string) {
  return PARTNER_TYPES.find(item => item.id === id) ?? null;
}

export function cleanPartnerApplication(input: Partial<PartnerApplicationInput>): { ok: true; value: PartnerApplicationInput } | { ok: false; error: string } {
  const value: PartnerApplicationInput = {
    orgName: clip(input.orgName, 120),
    type: clip(input.type, 40),
    country: clip(input.country, 80),
    region: clip(input.region, 80),
    contactName: clip(input.contactName, 80),
    email: clip(input.email, 120).toLowerCase(),
    phone: clip(input.phone, 40),
    website: clip(input.website, 200),
    message: clip(input.message, 1000),
    companyFax: clip(input.companyFax, 80),
  };
  if (value.companyFax) return { ok: true, value };
  if (value.orgName.length < 2) return { ok: false, error: 'Add the organisation name.' };
  if (!partnerType(value.type)) return { ok: false, error: 'Choose a partner type.' };
  if (value.country.length < 2) return { ok: false, error: 'Add the country.' };
  if (value.contactName.length < 2) return { ok: false, error: 'Add a contact name.' };
  if (!EMAIL.test(value.email)) return { ok: false, error: 'Add a real email address.' };
  if (value.website && !/^https:\/\/[^\s]+$/i.test(value.website)) return { ok: false, error: 'A website has to start with https://.' };
  return { ok: true, value };
}

export function approvalRoute(type: string): { route: string; nextPath: string } | null {
  const found = partnerType(type);
  if (!found) return null;
  return { route: found.route, nextPath: found.nextPath };
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
