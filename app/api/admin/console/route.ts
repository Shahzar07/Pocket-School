import { NextResponse } from 'next/server';
import firebaseConfig from '@/firebase-applet-config.json';
import { adminFromVerifiedIdentity } from '@/lib/admin-access';
import { bearerToken, lookupIdToken } from '@/lib/identity-token';
import { activityDocument, requestClient } from '@/lib/audit/model';
import {
  initialSuperAdmin,
  auditEntry,
  customClaimsFor,
  decideModeration,
  decideRoleChange,
  decideSparks,
  platformRoleFor,
  loginBlocked,
  resolveStaffRole,
  superAdminIds,
  type AccountState,
  type StaffProfile,
  type StaffRole,
} from '@/lib/admin-console';

export const runtime = 'nodejs';

type AdminApp = import('firebase-admin/app').App;

async function callerFromToken(request: Request): Promise<{
  uid: string;
  email: string;
  role: string;
  adminRole: string;
} | null> {
  if (request.headers.get('x-poket-view-as') === '1') return null;
  const identity = await lookupIdToken(bearerToken(request.headers.get('authorization')));
  if (!identity) return null;
  return {
    uid: identity.uid,
    email: identity.email,
    role: typeof identity.customAttributes.role === 'string' ? identity.customAttributes.role : '',
    adminRole: typeof identity.customAttributes.adminRole === 'string' ? identity.customAttributes.adminRole : '',
  };
}

async function adminApp(): Promise<AdminApp | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const existing = getApps()[0];
  return existing ?? initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as Record<string, string>),
  });
}

async function namedDb(app: AdminApp) {
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

function asProfile(id: string, data: Record<string, unknown> | undefined): StaffProfile {
  return {
    id,
    email: typeof data?.email === 'string' ? data.email : '',
    role: typeof data?.role === 'string' ? data.role : '',
    adminRole: typeof data?.adminRole === 'string' ? data.adminRole : '',
  };
}

export async function POST(request: Request) {
  const caller = await callerFromToken(request);
  if (!caller) return NextResponse.json({ error: 'Sign in again to use the admin console.' }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === 'string' ? body.action : '';
  const postedRaw = Array.isArray(body?.directory) ? body.directory as Record<string, unknown>[] : [];
  const postedDirectory = postedRaw.map(item => asProfile(String(item.id ?? ''), item)).filter(item => item.id);
  const statusOf = (data: Record<string, unknown> | undefined) =>
    typeof data?.accountStatus === 'string' ? data.accountStatus : 'active';
  const status = new Map<string, string>();
  postedRaw.forEach(item => {
    const id = String(item.id ?? '');
    if (id) status.set(id, statusOf(item));
  });

  const app = await adminApp();
  const db = app ? await namedDb(app) : null;
  let directory = postedDirectory;
  let callerProfile: StaffProfile = {
    id: caller.uid,
    email: caller.email,
    role: caller.role,
    adminRole: caller.adminRole,
  };
  if (db) {
    const snap = await db.collection('users').limit(500).get();
    directory = snap.docs.map(item => asProfile(item.id, item.data()));
    status.clear();
    snap.docs.forEach(item => status.set(item.id, statusOf(item.data())));
    const self = directory.find(item => item.id === caller.uid);
    if (self) callerProfile = { ...self, email: self.email || caller.email };
  }
  if (!callerProfile.email) callerProfile = { ...callerProfile, email: caller.email };
  const allowed = adminFromVerifiedIdentity({
    email: caller.email,
    role: caller.role,
    adminRole: caller.adminRole,
    profileRole: db ? callerProfile.role : undefined,
  });
  if (!allowed) return NextResponse.json({ error: 'This account is not an admin.' }, { status: 403 });
  const actor = resolveStaffRole(callerProfile);
  if (!actor) return NextResponse.json({ error: 'This account is not an admin.' }, { status: 403 });
  if (loginBlocked(status.get(caller.uid))) {
    return NextResponse.json({ error: 'This account cannot use the admin console.' }, { status: 403 });
  }

  const targetId = typeof body?.targetId === 'string' ? body.targetId : '';
  const target = directory.find(item => item.id === targetId) ?? null;
  const supers = superAdminIds(directory);
  const reason = typeof body?.reason === 'string' ? body.reason : '';

  const deny = (error: string, status = 403) => NextResponse.json({ error }, { status });

  if (action === 'sync-claims') {
    const staff = resolveStaffRole(callerProfile);
    const platformRole = platformRoleFor(staff, callerProfile.role ?? 'admin');
    const seeded = initialSuperAdmin(caller.email);
    if (db && staff) {
      await db.collection('users').doc(caller.uid).set({
        adminRole: staff,
        role: platformRole,
        email: caller.email || callerProfile.email,
        ...(seeded ? { name: seeded.name } : {}),
      }, { merge: true });
      const { getAuth } = await import('firebase-admin/auth');
      await getAuth(app!).setCustomUserClaims(caller.uid, customClaimsFor(staff, platformRole));
    }
    return NextResponse.json({
      ok: true,
      applied: Boolean(db),
      staffRole: staff,
      claims: customClaimsFor(staff, platformRole),
    });
  }

  if (!target && action !== 'invite') return deny('Choose a user first.', 400);

  if (action === 'set-role') {
    const next = typeof body?.staffRole === 'string' && body.staffRole ? body.staffRole as StaffRole : null;
    const decision = decideRoleChange({
      actorId: caller.uid,
      actor,
      targetId,
      target: target ? resolveStaffRole(target) : null,
      next,
      superAdminIds: supers,
    });
    if (!decision.ok) return deny(decision.error);
    const platformRole = platformRoleFor(next, target?.role ?? 'student');
    if (db && target) {
      const before = { adminRole: target.adminRole ?? '', role: target.role ?? '' };
      await db.collection('users').doc(targetId).set({ adminRole: next ?? '', role: platformRole }, { merge: true });
      const { getAuth } = await import('firebase-admin/auth');
      await getAuth(app!).setCustomUserClaims(targetId, customClaimsFor(next, platformRole));
      await writeAudit(db, request, caller, actor, 'set-role', targetId, before, { adminRole: next ?? '', role: platformRole });
    }
    return NextResponse.json({ ok: true, applied: Boolean(db), role: platformRole, adminRole: next ?? '' });
  }

  if (action === 'set-status') {
    const next = body?.status as AccountState;
    const decision = decideModeration({
      actorId: caller.uid,
      actor,
      targetId,
      target: target ? resolveStaffRole(target) : null,
      next,
      superAdminIds: supers,
      reason,
    });
    if (!decision.ok) return deny(decision.error);
    if (db && target) {
      await db.collection('users').doc(targetId).set({
        accountStatus: next,
        statusReason: reason.trim(),
        ...(next === 'deleted' ? { deletedAt: Date.now() } : { deletedAt: null }),
      }, { merge: true });
      const { getAuth } = await import('firebase-admin/auth');
      await getAuth(app!).updateUser(targetId, { disabled: next === 'banned' || next === 'deleted' });
      await writeAudit(db, request, caller, actor, 'set-status', targetId, { status: 'previous' }, { status: next, reason: reason.trim() });
    }
    return NextResponse.json({ ok: true, applied: Boolean(db), status: next, reason: reason.trim() });
  }

  if (action === 'sparks') {
    const amount = Number(body?.amount);
    const balance = Number(body?.balance ?? 0);
    const decision = decideSparks({
      actor,
      target: target ? resolveStaffRole(target) : null,
      amount,
      reason,
      balance,
    });
    if (!decision.ok) return deny(decision.error);
    if (db && target) {
      const ref = db.collection('users').doc(targetId);
      const nextBalance = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const current = Number(snap.data()?.sparksBalance ?? balance);
        const after = current + amount;
        tx.set(ref, { sparksBalance: after }, { merge: true });
        tx.set(ref.collection('spark_transactions').doc(), {
          amount,
          type: 'admin_grant',
          note: reason.trim(),
          balanceAfter: after,
          createdAt: Date.now(),
          actorId: caller.uid,
        });
        return after;
      });
      await writeAudit(db, request, caller, actor, 'sparks', targetId, { balance }, { balance: nextBalance, amount, reason: reason.trim() });
      return NextResponse.json({ ok: true, applied: true, balance: nextBalance });
    }
    return NextResponse.json({ ok: true, applied: false, amount, reason: reason.trim() });
  }

  if (action === 'tier' || action === 'permission') {
    if (target && resolveStaffRole(target) === 'super_admin' && actor !== 'super_admin') {
      return deny('Only a super admin can change a super admin.');
    }
    if (actor !== 'super_admin' && actor !== 'admin' && actor !== 'finance') {
      return deny('This role cannot change access.');
    }
    const tier = body?.tier == null ? null : Number(body.tier);
    const permission = typeof body?.permission === 'string' ? body.permission : '';
    const mode = body?.mode === 'revoke' ? 'revoke' : 'grant';
    if (db && target) {
      const patch: Record<string, unknown> = {};
      if (tier != null && Number.isFinite(tier)) patch.accessTier = Math.max(0, Math.min(6, Math.round(tier)));
      if (permission) {
        const { FieldValue } = await import('firebase-admin/firestore');
        patch.permissions = mode === 'revoke' ? FieldValue.arrayRemove(permission) : FieldValue.arrayUnion(permission);
      }
      await db.collection('users').doc(targetId).set(patch, { merge: true });
      await writeAudit(db, request, caller, actor, action, targetId, {}, { tier, permission, mode, reason: reason.trim() });
    }
    return NextResponse.json({ ok: true, applied: Boolean(db), tier, permission, mode });
  }

  if (action === 'revoke-sessions') {
    if (actor !== 'super_admin' && actor !== 'admin' && actor !== 'support') return deny('This role cannot sign users out.');
    if (db && target) {
      const { getAuth } = await import('firebase-admin/auth');
      await getAuth(app!).revokeRefreshTokens(targetId);
      await writeAudit(db, request, caller, actor, 'revoke-sessions', targetId, {}, { reason: reason.trim() });
    }
    return NextResponse.json({ ok: true, applied: Boolean(db) });
  }

  if (action === 'password-reset') {
    if (actor !== 'super_admin' && actor !== 'admin' && actor !== 'support') return deny('This role cannot reset passwords.');
    const email = target?.email || (typeof body?.email === 'string' ? body.email : '');
    if (!email) return deny('That account has no email address.', 400);
    if (!app) return NextResponse.json({ ok: true, applied: false, email });
    const { getAuth } = await import('firebase-admin/auth');
    const link = await getAuth(app).generatePasswordResetLink(email);
    if (db) await writeAudit(db, request, caller, actor, 'password-reset', targetId || email, {}, { email });
    return NextResponse.json({ ok: true, applied: true, email, resetLink: link });
  }

  if (action === 'invite') {
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const staffRole = body?.staffRole as StaffRole;
    if (!email || !staffRole) return deny('An email and a role are required.', 400);
    const decision = decideRoleChange({
      actorId: caller.uid,
      actor,
      targetId: email,
      target: null,
      next: staffRole,
      superAdminIds: supers,
    });
    if (!decision.ok) return deny(decision.error);
    if (db) {
      await db.collection('admin_invites').doc(email).set({
        email,
        staffRole,
        invitedBy: caller.uid,
        createdAt: Date.now(),
      });
      const existing = directory.find(item => item.email?.trim().toLowerCase() === email);
      if (existing?.id) {
        await db.collection('users').doc(existing.id).set({
          adminRole: staffRole,
          role: 'admin',
        }, { merge: true });
        const { getAuth } = await import('firebase-admin/auth');
        await getAuth(app!).setCustomUserClaims(existing.id, customClaimsFor(staffRole, 'admin'));
      }
      await writeAudit(db, request, caller, actor, 'invite', email, {}, { staffRole, email });
    }
    return NextResponse.json({ ok: true, applied: Boolean(db), email, staffRole });
  }

  return deny('Unknown admin action.', 400);
}

async function writeAudit(
  db: Awaited<ReturnType<typeof namedDb>>,
  request: Request,
  caller: { uid: string; email: string },
  actorRole: string,
  action: string,
  targetId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const entry = auditEntry({
    actorId: caller.uid,
    actorEmail: caller.email,
    action,
    targetId,
    before,
    after,
  });
  await db.collection('admin_audit').add(entry);
  const client = requestClient(request.headers);
  const event = activityDocument({
    action: action === 'set-role' ? 'role.switch' : 'admin.action',
    actorId: caller.uid,
    actorEmail: caller.email,
    actorRole,
    ip: client.ip,
    device: client.device,
    targetType: action === 'invite' ? 'invite' : 'user',
    targetId,
    targetLabel: action,
    before,
    after,
  });
  const ref = db.collection('activity_log').doc();
  await ref.set(event);
}
