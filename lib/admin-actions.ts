/**
 * Browser side of the admin console. The server applies the change when
 * FIREBASE_SERVICE_ACCOUNT is set. Otherwise the same policy runs here and
 * the write goes through the admin Firestore rules.
 */

import { sendPasswordResetEmail } from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  awardSparks,
  grantPermission,
  revokePermission,
  setAccountStatus,
  setUserSubscription,
  type AccountStatus,
} from '@/lib/db';
import {
  auditEntry,
  decideModeration,
  decideRoleChange,
  decideSparks,
  platformRoleFor,
  resolveStaffRole,
  superAdminIds,
  can,
  type AccountState,
  type AuditRecord,
  type StaffProfile,
  type StaffRole,
} from '@/lib/admin-console';
import { readViewAs } from '@/lib/view-as';

export interface ConsoleProfile extends StaffProfile {
  accountStatus?: string;
}

export interface AdminResult {
  applied: boolean;
  auditFailed?: boolean;
  resetLink?: string;
  note?: string;
}

async function writeClientAudit(entry: Omit<AuditRecord, 'at'>): Promise<void> {
  await addDoc(collection(db, 'admin_audit'), auditEntry(entry));
}

async function commit(input: {
  action: string;
  targetId?: string;
  directory: ConsoleProfile[];
  body?: Record<string, unknown>;
  decision: { ok: true } | { ok: false; error: string };
  fallback: () => Promise<void>;
  audit: Omit<AuditRecord, 'at'>;
  note?: string;
}): Promise<AdminResult> {
  if (readViewAs()) throw new Error('View-as is read-only.');
  let raw: Record<string, unknown> = {};
  let applied = false;
  let refused: string | null = null;
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sign in again to use the admin console.');
    const res = await fetch('/api/admin/console', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: input.action,
        targetId: input.targetId,
        directory: input.directory,
        ...input.body,
      }),
    });
    raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) refused = typeof raw.error === 'string' ? raw.error : 'The admin console refused that action.';
    else applied = Boolean(raw.applied);
  } catch (err) {
    if (err instanceof Error && err.message === 'Sign in again to use the admin console.') throw err;
    if (!input.decision.ok) throw new Error(input.decision.error);
  }
  if (refused) throw new Error(refused);
  if (applied) {
    return {
      applied: true,
      resetLink: typeof raw.resetLink === 'string' ? raw.resetLink : undefined,
    };
  }
  if (!input.decision.ok) throw new Error(input.decision.error);
  await input.fallback();
  try {
    await writeClientAudit(input.audit);
  } catch (err) {
    console.error('[admin-audit]', err);
    return { applied: false, auditFailed: true, note: input.note };
  }
  return { applied: false, note: input.note };
}

export async function syncStaffClaims(directory: ConsoleProfile[]): Promise<{ applied: boolean; staffRole: string | null }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return { applied: false, staffRole: null };
  const res = await fetch('/api/admin/console', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'sync-claims', directory }),
  });
  const raw = await res.json().catch(() => ({})) as { applied?: boolean; staffRole?: string | null };
  return { applied: Boolean(raw.applied), staffRole: raw.staffRole ?? null };
}

export async function changeStaffRole(input: {
  actorId: string;
  actorEmail: string;
  actor: StaffRole | null;
  directory: ConsoleProfile[];
  target: ConsoleProfile;
  next: StaffRole | null;
}): Promise<AdminResult> {
  const targetId = input.target.id ?? '';
  const decision = decideRoleChange({
    actorId: input.actorId,
    actor: input.actor,
    targetId,
    target: resolveStaffRole(input.target),
    next: input.next,
    superAdminIds: superAdminIds(input.directory),
  });
  const platformRole = platformRoleFor(input.next, input.target.role ?? 'student');
  return commit({
    action: 'set-role',
    targetId,
    directory: input.directory,
    body: { staffRole: input.next ?? '' },
    decision,
    fallback: async () => {
      await updateDoc(doc(db, 'users', targetId), {
        adminRole: input.next ?? '',
        role: platformRole,
        updatedAt: serverTimestamp(),
      });
    },
    audit: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: 'set-role',
      targetId,
      before: { adminRole: input.target.adminRole ?? '', role: input.target.role ?? '' },
      after: { adminRole: input.next ?? '', role: platformRole },
    },
  });
}

export async function changeAccountState(input: {
  actorId: string;
  actorEmail: string;
  actor: StaffRole | null;
  directory: ConsoleProfile[];
  target: ConsoleProfile;
  next: AccountState;
  reason: string;
}): Promise<AdminResult> {
  const targetId = input.target.id ?? '';
  const decision = decideModeration({
    actorId: input.actorId,
    actor: input.actor,
    targetId,
    target: resolveStaffRole(input.target),
    next: input.next,
    superAdminIds: superAdminIds(input.directory),
    reason: input.reason,
  });
  return commit({
    action: 'set-status',
    targetId,
    directory: input.directory,
    body: { status: input.next, reason: input.reason },
    decision,
    fallback: () => setAccountStatus(targetId, input.next as AccountStatus, input.reason.trim()),
    audit: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: 'set-status',
      targetId,
      before: { status: input.target.accountStatus ?? 'active' },
      after: { status: input.next, reason: input.reason.trim() },
    },
  });
}

export async function adjustSparks(input: {
  actorId: string;
  actorEmail: string;
  actor: StaffRole | null;
  directory: ConsoleProfile[];
  target: ConsoleProfile;
  amount: number;
  balance: number;
  reason: string;
}): Promise<AdminResult> {
  const targetId = input.target.id ?? '';
  const decision = decideSparks({
    actor: input.actor,
    target: resolveStaffRole(input.target),
    amount: input.amount,
    reason: input.reason,
    balance: input.balance,
  });
  return commit({
    action: 'sparks',
    targetId,
    directory: input.directory,
    body: { amount: input.amount, balance: input.balance, reason: input.reason },
    decision,
    fallback: () => awardSparks(targetId, input.amount, 'admin_grant', input.reason.trim()).then(() => undefined),
    audit: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: 'sparks',
      targetId,
      before: { balance: input.balance },
      after: { balance: input.balance + input.amount, amount: input.amount, reason: input.reason.trim() },
    },
  });
}

export async function changeAccess(input: {
  actorId: string;
  actorEmail: string;
  actor: StaffRole | null;
  directory: ConsoleProfile[];
  target: ConsoleProfile;
  tier?: number | null;
  subscription?: 'free' | 'academic' | null;
  permission?: string;
  mode?: 'grant' | 'revoke';
  reason: string;
}): Promise<AdminResult> {
  const targetId = input.target.id ?? '';
  if (!can(input.actor, 'tier')) return Promise.reject(new Error('This role cannot change access.'));
  if (resolveStaffRole(input.target) === 'super_admin' && !can(input.actor, 'manage_super')) {
    return Promise.reject(new Error('Only a super admin can change a super admin.'));
  }
  const mode = input.mode ?? 'grant';
  return commit({
    action: input.permission ? 'permission' : 'tier',
    targetId,
    directory: input.directory,
    body: {
      tier: input.tier,
      permission: input.permission ?? '',
      mode,
      reason: input.reason,
    },
    decision: { ok: true },
    fallback: async () => {
      if (input.subscription) await setUserSubscription(targetId, input.subscription);
      if (input.tier != null && Number.isFinite(input.tier)) {
        await updateDoc(doc(db, 'users', targetId), {
          accessTier: Math.max(0, Math.min(6, Math.round(input.tier))),
          updatedAt: serverTimestamp(),
        });
      }
      if (input.permission) {
        if (mode === 'revoke') await revokePermission(targetId, input.permission);
        else await grantPermission(targetId, input.permission);
      }
    },
    audit: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: input.permission ? 'permission' : 'tier',
      targetId,
      before: {},
      after: {
        tier: input.tier ?? null,
        subscription: input.subscription ?? null,
        permission: input.permission ?? '',
        mode,
        reason: input.reason.trim(),
      },
    },
  });
}

export async function inviteStaff(input: {
  actorId: string;
  actorEmail: string;
  actor: StaffRole | null;
  directory: ConsoleProfile[];
  email: string;
  staffRole: StaffRole;
}): Promise<AdminResult> {
  const email = input.email.trim().toLowerCase();
  const decision = decideRoleChange({
    actorId: input.actorId,
    actor: input.actor,
    targetId: email,
    target: null,
    next: input.staffRole,
    superAdminIds: superAdminIds(input.directory),
  });
  const existing = input.directory.find(item => item.email?.trim().toLowerCase() === email);
  return commit({
    action: 'invite',
    directory: input.directory,
    body: { email, staffRole: input.staffRole },
    decision,
    fallback: async () => {
      await setDoc(doc(db, 'admin_invites', email), {
        email,
        staffRole: input.staffRole,
        invitedBy: input.actorId,
        createdAt: Date.now(),
      });
      if (existing?.id) {
        await updateDoc(doc(db, 'users', existing.id), {
          adminRole: input.staffRole,
          role: 'admin',
          updatedAt: serverTimestamp(),
        });
      }
    },
    audit: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: 'invite',
      targetId: email,
      before: {},
      after: { staffRole: input.staffRole, email },
    },
  });
}

export async function resetStaffPassword(input: {
  actorId: string;
  actorEmail: string;
  actor: StaffRole | null;
  directory: ConsoleProfile[];
  target: ConsoleProfile;
}): Promise<AdminResult> {
  if (!can(input.actor, 'sessions')) return Promise.reject(new Error('This role cannot reset passwords.'));
  const email = input.target.email?.trim() ?? '';
  if (!email) return Promise.reject(new Error('That account has no email address.'));
  const targetId = input.target.id ?? email;
  return commit({
    action: 'password-reset',
    targetId,
    directory: input.directory,
    body: { email },
    decision: { ok: true },
    fallback: () => sendPasswordResetEmail(auth, email),
    audit: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: 'password-reset',
      targetId,
      before: {},
      after: { email },
    },
  });
}

export async function revokeStaffSessions(input: {
  actorId: string;
  actorEmail: string;
  actor: StaffRole | null;
  directory: ConsoleProfile[];
  target: ConsoleProfile;
  reason: string;
}): Promise<AdminResult> {
  if (!can(input.actor, 'sessions')) return Promise.reject(new Error('This role cannot sign users out.'));
  const targetId = input.target.id ?? '';
  return commit({
    action: 'revoke-sessions',
    targetId,
    directory: input.directory,
    body: { reason: input.reason },
    decision: { ok: true },
    fallback: async () => undefined,
    note: 'The service account is not configured, so existing sessions stay signed in. The request is in the audit log.',
    audit: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: 'revoke-sessions',
      targetId,
      before: {},
      after: { reason: input.reason.trim() },
    },
  });
}
