import { isAdminConfigured, adminDb } from '../firebase-admin';
import {
  filterPublicDirectory,
  isPublicDirectorySchool,
  membershipOutcome,
  toPublicInstitution,
  type DirectorySource,
  type PublicInstitution,
} from '../institutions/public-directory';

export const DIRECTORY_UNAVAILABLE =
  'School list is unavailable until FIREBASE_SERVICE_ACCOUNT is set. You can still join independently.';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sourceFrom(id: string, data: FirebaseFirestore.DocumentData): DirectorySource {
  const branding = data.branding && typeof data.branding === 'object' ? data.branding as DirectorySource['branding'] : undefined;
  const address = data.address && typeof data.address === 'object' ? data.address as DirectorySource['address'] : undefined;
  return {
    id,
    name: text(data.name),
    displayName: text(data.displayName),
    status: text(data.status),
    country: text(data.country),
    state: text(data.state),
    city: text(data.city),
    plan: text(data.plan),
    package: text(data.package),
    packageId: text(data.packageId),
    tier: text(data.tier),
    listedForSelfJoin: data.listedForSelfJoin === true,
    publicListing: data.publicListing === true,
    billingPhase: text(data.billingPhase),
    logo: text(data.logo),
    logoUrl: text(data.logoUrl),
    branding,
    address,
    inviteAutoApprove: data.inviteAutoApprove === true,
  };
}

export async function listPublicInstitutions(input: {
  country?: string;
  state?: string;
  q?: string;
}): Promise<{ configured: boolean; institutions: PublicInstitution[]; message?: string }> {
  if (!isAdminConfigured()) {
    return { configured: false, institutions: [], message: DIRECTORY_UNAVAILABLE };
  }
  const snap = await adminDb().collection('institutions').limit(400).get();
  const rows = snap.docs.map((doc) => sourceFrom(doc.id, doc.data()));
  return { configured: true, institutions: filterPublicDirectory(rows, input) };
}

export async function lookupInviteCode(code: string): Promise<{
  configured: boolean;
  institution: PublicInstitution | null;
  autoApprove: boolean;
  valid: boolean;
}> {
  const cleaned = code.trim().toUpperCase();
  if (!isAdminConfigured()) return { configured: false, institution: null, autoApprove: false, valid: false };
  if (!/^[A-Z0-9-]{4,16}$/.test(cleaned)) return { configured: true, institution: null, autoApprove: false, valid: false };
  const snap = await adminDb().doc(`join_codes/${cleaned}`).get();
  if (!snap.exists) return { configured: true, institution: null, autoApprove: false, valid: false };
  const institutionId = text(snap.get('institutionId'));
  if (!institutionId) return { configured: true, institution: null, autoApprove: false, valid: false };
  const academy = await adminDb().doc(`institutions/${institutionId}`).get();
  if (!academy.exists) return { configured: true, institution: null, autoApprove: false, valid: false };
  const source = sourceFrom(academy.id, academy.data() ?? {});
  if (!isPublicDirectorySchool(source)) return { configured: true, institution: null, autoApprove: false, valid: false };
  const schoolAllows = source.inviteAutoApprove === true || snap.get('autoApprove') === true;
  return {
    configured: true,
    institution: toPublicInstitution(source),
    autoApprove: schoolAllows,
    valid: true,
  };
}

export function decideMembership(input: { eligible: boolean; codeValid: boolean; autoApprove: boolean }) {
  return membershipOutcome(input);
}
