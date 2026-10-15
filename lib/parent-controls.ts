/**
 * Parent controls for linked children.
 * A parent never receives a child's name from an email request.
 * Firestore rules repeat the field lists and the link state machine.
 */

export const NEUTRAL_LINK = 'If that email belongs to a student, they will be asked to approve. Their name stays hidden until they say yes.';

export const UNDER13_PROFILE_FIELDS = [
  'name',
  'displayName',
  'bio',
  'avatarUrl',
  'photoStoragePath',
  'updatedAt',
] as const;

export const TEACHER_MESSAGE_PREFS = ['all', 'digest', 'off'] as const;
export type TeacherMessagePref = (typeof TEACHER_MESSAGE_PREFS)[number];

export interface ChildControls {
  childId: string;
  weeklyReportEmail: boolean;
  weeklyReportInApp: boolean;
  screenTimeMinutes: number;
  sparksDailyLimit: number;
  purchaseApproval: boolean;
  teacherMessages: TeacherMessagePref;
}

export interface PaymentMethod {
  brand: string;
  last4: string;
  expiry: string;
  holder: string;
}

export interface Under13Profile {
  name: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  photoStoragePath: string;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function defaultChildControls(childId: string): ChildControls {
  return {
    childId,
    weeklyReportEmail: true,
    weeklyReportInApp: true,
    screenTimeMinutes: 120,
    sparksDailyLimit: 50,
    purchaseApproval: true,
    teacherMessages: 'all',
  };
}

export function normaliseChildControls(input: Partial<ChildControls> & { childId: string }): ChildControls {
  const base = defaultChildControls(input.childId);
  const minutes = Number(input.screenTimeMinutes ?? base.screenTimeMinutes);
  const sparks = Number(input.sparksDailyLimit ?? base.sparksDailyLimit);
  const messages = TEACHER_MESSAGE_PREFS.includes(input.teacherMessages as TeacherMessagePref)
    ? input.teacherMessages as TeacherMessagePref
    : base.teacherMessages;
  return {
    childId: input.childId,
    weeklyReportEmail: input.weeklyReportEmail ?? base.weeklyReportEmail,
    weeklyReportInApp: input.weeklyReportInApp ?? base.weeklyReportInApp,
    screenTimeMinutes: clamp(Number.isFinite(minutes) ? minutes : base.screenTimeMinutes, 0, 1440),
    sparksDailyLimit: Math.max(0, Math.round(Number.isFinite(sparks) ? sparks : base.sparksDailyLimit)),
    purchaseApproval: input.purchaseApproval ?? base.purchaseApproval,
    teacherMessages: messages,
  };
}

export function parentMayEditChild(ageTier: string | null | undefined): boolean {
  return ageTier === 'under13';
}

export function under13ProfilePatch(input: Partial<Under13Profile>): Record<string, string> {
  const patch: Record<string, string> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.displayName !== undefined) patch.displayName = input.displayName.trim();
  if (input.bio !== undefined) patch.bio = input.bio.trim();
  if (input.avatarUrl) patch.avatarUrl = input.avatarUrl;
  if (input.photoStoragePath) patch.photoStoragePath = input.photoStoragePath;
  for (const key of Object.keys(patch)) {
    if (!(UNDER13_PROFILE_FIELDS as readonly string[]).includes(key)) delete patch[key];
  }
  return patch;
}

export function childPhotoPath(parentUid: string, childId: string): string {
  const safeChild = childId.replace(/[^A-Za-z0-9_-]/g, '');
  const safeParent = parentUid.replace(/[^A-Za-z0-9_-]/g, '');
  return `media/${safeParent}/child-${safeChild}.jpg`;
}

export function inviteCodeFromBytes(bytes: Uint8Array): string {
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    const value = bytes[index % bytes.length] ?? 0;
    code += INVITE_ALPHABET[value % INVITE_ALPHABET.length];
  }
  return code;
}

export function inviteCodeValid(code: string): boolean {
  return /^[A-Z2-9]{8}$/.test(code);
}

export function parentLinkId(parentId: string, studentId: string): string {
  return `${parentId}_${studentId}`;
}

export function pendingLink(input: {
  parentId: string;
  parentName: string;
  parentEmail: string;
  studentId: string;
  studentEmail: string;
}): {
  parentId: string;
  parentName: string;
  parentEmail: string;
  studentId: string;
  studentEmail: string;
  status: 'pending';
} {
  return {
    parentId: input.parentId,
    parentName: input.parentName.trim() || 'Parent',
    parentEmail: input.parentEmail.trim().toLowerCase(),
    studentId: input.studentId,
    studentEmail: input.studentEmail.trim().toLowerCase(),
    status: 'pending',
  };
}

export function openInvite(parentId: string, parentName: string, code: string): {
  parentId: string;
  parentName: string;
  code: string;
  status: 'open';
} | null {
  if (!inviteCodeValid(code)) return null;
  return { parentId, parentName: parentName.trim() || 'Parent', code, status: 'open' };
}

export function acceptInvite(
  invite: { status: string; parentId: string },
  childId: string,
): { status: 'accepted'; childId: string; parentId: string } | null {
  if (invite.status !== 'open' || !childId || !invite.parentId) return null;
  return { status: 'accepted', childId, parentId: invite.parentId };
}

export function decideLink(
  current: { status: string; studentId: string; parentId: string },
  studentId: string,
  approve: boolean,
): { status: 'approved' | 'rejected'; parentId: string } | null {
  if (current.status !== 'pending' || current.studentId !== studentId) return null;
  return { status: approve ? 'approved' : 'rejected', parentId: current.parentId };
}

/** The new list may only add the student who just approved. */
export function childMayAddSelf(before: readonly string[], after: readonly string[], studentId: string): boolean {
  if (before.includes(studentId)) return false;
  if (after.length !== before.length + 1) return false;
  if (!after.includes(studentId)) return false;
  return before.every(id => after.includes(id));
}

/** A parent may only remove children. */
export function parentMayShrinkChildIds(before: readonly string[], after: readonly string[]): boolean {
  if (after.length >= before.length) return false;
  const prior = new Set(before);
  return after.every(id => prior.has(id));
}

export function normalisePaymentMethod(input: PaymentMethod): PaymentMethod {
  const expiry = input.expiry.trim();
  return {
    brand: input.brand.trim().slice(0, 24),
    last4: input.last4.replace(/\D/g, '').slice(-4),
    expiry: /^\d{2}\/\d{2}$/.test(expiry) ? expiry : '',
    holder: input.holder.trim().slice(0, 80),
  };
}

export function paymentMethodSafe(method: PaymentMethod): boolean {
  const next = normalisePaymentMethod(method);
  return next.last4.length === 4 && next.last4 === method.last4.replace(/\D/g, '').slice(-4) && !/\d{5,}/.test(method.brand + method.holder);
}

export function withinSparksLimit(spentToday: number, amount: number, limit: number): boolean {
  if (amount <= 0) return true;
  if (!Number.isFinite(limit) || limit < 0) return true;
  return spentToday + amount <= limit;
}

export function withinScreenTime(usedMinutes: number, limitMinutes: number): boolean {
  return usedMinutes <= limitMinutes;
}

export function purchaseNeedsParent(controls: { purchaseApproval: boolean } | null | undefined): boolean {
  return controls?.purchaseApproval === true;
}

export function strictestControls(rows: ChildControls[]): ChildControls | null {
  if (!rows.length) return null;
  return rows.reduce((tight, row) => ({
    childId: row.childId,
    weeklyReportEmail: tight.weeklyReportEmail && row.weeklyReportEmail,
    weeklyReportInApp: tight.weeklyReportInApp && row.weeklyReportInApp,
    screenTimeMinutes: Math.min(tight.screenTimeMinutes, row.screenTimeMinutes),
    sparksDailyLimit: Math.min(tight.sparksDailyLimit, row.sparksDailyLimit),
    purchaseApproval: tight.purchaseApproval || row.purchaseApproval,
    teacherMessages: row.teacherMessages === 'off' || tight.teacherMessages === 'off'
      ? 'off'
      : row.teacherMessages === 'digest' || tight.teacherMessages === 'digest'
        ? 'digest'
        : 'all',
  }));
}

export function reportChannels(controls: Pick<ChildControls, 'weeklyReportEmail' | 'weeklyReportInApp'>): {
  email: boolean;
  inApp: boolean;
} {
  return { email: controls.weeklyReportEmail, inApp: controls.weeklyReportInApp };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
