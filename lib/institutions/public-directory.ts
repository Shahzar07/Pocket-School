/**
 * Public school directory for sign-up. Only active Institute or Enterprise
 * academies that turned public listing on are returned, and only the fields
 * a signed-out visitor needs.
 */

export const DIRECTORY_PACKAGES = ['institute', 'enterprise'] as const;

export type DirectoryPackage = (typeof DIRECTORY_PACKAGES)[number];

export interface DirectorySource {
  id: string;
  name?: string;
  displayName?: string;
  status?: string;
  country?: string;
  state?: string;
  city?: string;
  plan?: string;
  package?: string;
  packageId?: string;
  tier?: string;
  listedForSelfJoin?: boolean;
  publicListing?: boolean;
  billingPhase?: string;
  logo?: string;
  logoUrl?: string;
  branding?: { displayName?: string; logoUrl?: string };
  address?: { city?: string; state?: string };
  inviteAutoApprove?: boolean;
}

export interface PublicInstitution {
  id: string;
  displayName: string;
  city: string;
  state: string;
  country: string;
  logo: string;
  inviteAutoApprove: boolean;
}

export function directoryPackage(row: Pick<DirectorySource, 'package' | 'packageId' | 'tier' | 'plan'>): string {
  const raw = String(row.package || row.packageId || row.tier || row.plan || '').trim().toLowerCase();
  if (raw === 'oem') return 'enterprise';
  return raw;
}

export function isPublicDirectorySchool(row: DirectorySource): boolean {
  if (row.status !== 'active') return false;
  if (row.billingPhase === 'suspended' || row.billingPhase === 'pending_payment') return false;
  const listed = row.listedForSelfJoin === true || row.publicListing === true;
  if (!listed) return false;
  const pack = directoryPackage(row);
  return pack === 'institute' || pack === 'enterprise';
}

export function toPublicInstitution(row: DirectorySource): PublicInstitution {
  const displayName = (row.branding?.displayName || row.displayName || row.name || 'Institution').replace(/\s+/g, ' ').trim();
  return {
    id: row.id,
    displayName: displayName || 'Institution',
    city: (row.city || row.address?.city || '').replace(/\s+/g, ' ').trim(),
    state: (row.state || row.address?.state || '').replace(/\s+/g, ' ').trim(),
    country: (row.country || '').trim().toUpperCase(),
    logo: (row.branding?.logoUrl || row.logoUrl || row.logo || '').trim(),
    inviteAutoApprove: row.inviteAutoApprove === true,
  };
}

export function filterPublicDirectory(
  rows: readonly DirectorySource[],
  input: { country?: string; state?: string; q?: string },
): PublicInstitution[] {
  const country = (input.country || '').trim().toUpperCase();
  const state = (input.state || '').trim().toLowerCase();
  const q = (input.q || '').trim().toLowerCase();
  return rows
    .filter(isPublicDirectorySchool)
    .map(toPublicInstitution)
    .filter((row) => !country || row.country === country)
    .filter((row) => !state || row.state.toLowerCase() === state)
    .filter((row) => {
      if (!q) return true;
      const haystack = `${row.displayName} ${row.city} ${row.state}`.toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, 40);
}

export function membershipOutcome(input: {
  eligible: boolean;
  codeValid: boolean;
  autoApprove: boolean;
}): 'independent' | 'pending' | 'approved' | 'rejected' {
  if (!input.eligible) return 'independent';
  if (input.codeValid && input.autoApprove) return 'approved';
  return 'pending';
}
