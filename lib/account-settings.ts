/**
 * Profile and settings that a person may change on their own account.
 * Privileged fields (role, wallet, entitlements, staff role) are not in this list.
 * Firestore rules repeat the same names in `selfServiceFields()`.
 */

export const DELETION_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

export const SELF_SERVICE_FIELDS = [
  'name',
  'displayName',
  'bio',
  'avatarUrl',
  'photoStoragePath',
  'country',
  'timezone',
  'phone',
  'language',
  'currency',
  'level',
  'learningStyle',
  'yearGroup',
  'interests',
  'shareBoard',
  'notificationPrefs',
  'privacy',
  'instructor',
  'twoFactorEnabled',
  'sessionsRevokedAt',
  'deletionRequest',
  'email',
  'updatedAt',
  'onboardedAt',
  'studyDates',
  'childIds',
  'lastActiveAt',
  'region',
  'parentContacts',
] as const;

/** A signed-in person must not be able to set these on their own document. */
export const PRIVILEGED_PROFILE_FIELDS = [
  'role',
  'accessTier',
  'subscriptionTier',
  'permissions',
  'institutionId',
  'adminSparksGrantedAt',
  'accountStatus',
  'adminRole',
  'statusReason',
  'deletedAt',
  'cohortIds',
  'ageTier',
  'dateOfBirth',
  'emailVerified',
  'phoneVerified',
  'sparksBalance',
  'sparksMonthlyAllowance',
  'sparksGrantedAt',
  'xp',
] as const;

export const PROFILE_COUNTRIES = [
  'Malaysia',
  'Singapore',
  'Indonesia',
  'United Kingdom',
  'United States',
  'India',
  'Australia',
  'United Arab Emirates',
  'China',
  'Canada',
  'New Zealand',
  'Philippines',
  'Thailand',
  'Vietnam',
  'South Africa',
  'Nigeria',
  'Kenya',
  'Ireland',
  'France',
  'Germany',
] as const;

export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  messages: boolean;
  announcements: boolean;
  product: boolean;
}

export interface PrivacySettings {
  shareBoard: boolean;
  profilePublic: boolean;
  showEmail: boolean;
}

export interface InstructorProfile {
  headline: string;
  bio: string;
  public: boolean;
}

export type PayoutMethod = 'none' | 'paypal' | 'bank';

export interface PayoutDetails {
  method: PayoutMethod;
  email: string;
  accountName: string;
  bankName: string;
  accountLast4: string;
}

export interface DeletionRequest {
  requestedAt: number;
  scheduledFor: number;
}

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  email: true,
  push: true,
  messages: true,
  announcements: true,
  product: true,
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  shareBoard: true,
  profilePublic: false,
  showEmail: false,
};

export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: 'Enter a password' };
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  const score = Math.min(4, points) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;
  return { score, label: labels[score] };
}

export function passwordAcceptable(password: string): boolean {
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

export function scheduleDeletion(now: number): DeletionRequest {
  return { requestedAt: now, scheduledFor: now + DELETION_GRACE_MS };
}

export function deletionPending(request: DeletionRequest | null | undefined, now: number): boolean {
  return !!request && request.scheduledFor > now;
}

export function deletionClosed(request: DeletionRequest | null | undefined, now: number): boolean {
  return !!request && request.scheduledFor <= now;
}

export function formatDeletionDate(request: DeletionRequest): string {
  return new Date(request.scheduledFor).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function timezoneOptions(): string[] {
  const fallback = [
    'Asia/Kuala_Lumpur',
    'Asia/Singapore',
    'Asia/Jakarta',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
    'Australia/Sydney',
    'UTC',
  ];
  try {
    const supported = Intl.supportedValuesOf('timeZone');
    return supported.length ? supported : fallback;
  } catch {
    return fallback;
  }
}

export function normalisePayout(input: PayoutDetails): PayoutDetails {
  const last4 = input.accountLast4.replace(/\D/g, '').slice(-4);
  return {
    method: input.method,
    email: input.email.trim(),
    accountName: input.accountName.trim(),
    bankName: input.bankName.trim(),
    accountLast4: last4,
  };
}

export interface ProfileDraft {
  name: string;
  displayName: string;
  bio: string;
  country: string;
  timezone: string;
  phone: string;
  language: string;
  currency: string;
  avatarUrl: string;
  photoStoragePath: string;
  level: string;
  learningStyle: string;
  yearGroup: string;
  notificationPrefs: NotificationPrefs;
  privacy: PrivacySettings;
  twoFactorEnabled: boolean;
  instructor: InstructorProfile;
}

export function profilePatch(draft: ProfileDraft, role: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    name: draft.name.trim(),
    displayName: draft.displayName.trim(),
    bio: draft.bio.trim(),
    country: draft.country.trim(),
    timezone: draft.timezone.trim(),
    phone: draft.phone.trim(),
    language: draft.language,
    currency: draft.currency.trim().toUpperCase(),
    level: draft.level,
    learningStyle: draft.learningStyle,
    notificationPrefs: draft.notificationPrefs,
    privacy: draft.privacy,
    shareBoard: draft.privacy.shareBoard,
    twoFactorEnabled: draft.twoFactorEnabled,
  };
  if (draft.avatarUrl) patch.avatarUrl = draft.avatarUrl;
  if (draft.photoStoragePath) patch.photoStoragePath = draft.photoStoragePath;
  if (role === 'student' && draft.yearGroup) patch.yearGroup = draft.yearGroup;
  if (role === 'teacher') {
    patch.instructor = {
      headline: draft.instructor.headline.trim(),
      bio: draft.instructor.bio.trim(),
      public: draft.instructor.public,
    };
  }
  return patch;
}

export function sessionRevoked(revokedAt: number | null | undefined, sessionStartedAt: number): boolean {
  return typeof revokedAt === 'number' && sessionStartedAt > 0 && revokedAt > sessionStartedAt;
}
