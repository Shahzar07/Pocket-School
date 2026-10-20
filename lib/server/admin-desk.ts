/**
 * Admin desk reads and writes. A missing admin SDK returns an empty desk.
 * Every write is appended to admin_desk/log/audit and never updated.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb, isAdminConfigured } from '../firebase-admin';
import {
  bucketSeries,
  canOpenDesk,
  confirmBroadcast,
  decideSuspend,
  decideTierChange,
  hideSafeguardingIdentity,
  inDeskScope,
  isSuperDesk,
  recordAmberApproval,
  slaRemaining,
  visibleCaseTitle,
  type DeskActor,
} from '../admin/desk';
import { decideRoleChange, resolveStaffRole, superAdminIds, type StaffProfile, type StaffRole } from '../admin-console';
import { FEATURE_FLAGS, DEFAULT_FLAGS } from '../feature-flags';
import { GENESIS, emptyLegalHold, type ChainEntry } from '../ledger/chain';
import { exportCsv, exportPdf } from '../ledger/export';
import { cleanSlot } from '../safety-desk/policy';
import { readVerification, raiseVerification } from '../verification/policy';
import { decideOffer, decidePartner } from '../student-id/server';
import { reviewPartnerApplication } from './community-partners';
import { resolveAppeal } from './et-moderation';
import { appendChain } from './ledger';
import { ActionError } from './actions';
import { finishAdminTask } from './admin-tasks';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function actorFromProfile(uid: string, data: Record<string, unknown> | undefined): DeskActor {
  const staff = resolveStaffRole({
    id: uid,
    email: str(data?.email),
    role: str(data?.role),
    adminRole: str(data?.adminRole),
  });
  return {
    uid,
    role: str(data?.role),
    staffRole: staff === 'super_admin' || staff === 'admin' ? staff : null,
    institutionId: str(data?.institutionId),
    region: str(data?.region) || str(data?.state),
    country: str(data?.country),
    staffPost: str(data?.staffPost),
  };
}

async function ensureLog(): Promise<void> {
  const ref = db().doc('admin_desk/log');
  const snap = await ref.get();
  if (snap.exists) return;
  await ref.set({ chainSeq: 0, chainHead: GENESIS, legalHold: emptyLegalHold() });
}

async function audit(actor: DeskActor, action: string, targetId: string, after: Record<string, unknown>): Promise<void> {
  await ensureLog();
  await appendChain({
    parentPath: 'admin_desk/log',
    collection: 'audit',
    actorUid: actor.uid,
    actorRole: actor.staffRole ?? 'admin',
    action,
    diff: { before: {}, after: { ...after, targetId } },
  });
}

async function docs(label: string, run: () => Promise<FirebaseFirestore.QuerySnapshot>): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  try {
    const snap = await run();
    return snap.docs;
  } catch (error) {
    console.error('admin desk query failed', label, error instanceof Error ? error.message : error);
    return [];
  }
}

function rowScope(data: FirebaseFirestore.DocumentData): { institutionId: string; region: string; country: string } {
  return {
    institutionId: str(data.institutionId),
    region: str(data.region) || str(data.state),
    country: str(data.country),
  };
}

export async function loadAdminDesk(actor: DeskActor, now = Date.now()) {
  if (!isAdminConfigured() || !canOpenDesk(actor)) {
    return emptyDesk(actor, !isAdminConfigured());
  }
  const sensitive = hideSafeguardingIdentity(actor);
  const [verifications, merchants, community, offers, moderation, appeals, tickets, notices, authorities, alerts, institutions, refunds, users, flagsSnap, helplines, rotaSnap] = await Promise.all([
    docs('verification', () => db().collection('verification_reviews').orderBy('createdAt', 'desc').limit(40).get()),
    docs('merchants', () => db().collection('partners').where('status', '==', 'pending').limit(40).get()),
    docs('community', () => db().collection('communityPartnerApplications').where('status', '==', 'pending').limit(40).get()),
    docs('offers', () => db().collection('offers').where('status', '==', 'review').limit(40).get()),
    docs('moderation', () => db().collection('moderation_queue').limit(40).get()),
    docs('appeals', () => db().collection('moderation_appeals').where('status', '==', 'open').limit(40).get()),
    docs('safety', () => db().collection('hotline_tickets').orderBy('createdAt', 'desc').limit(40).get()),
    docs('schools', () => db().collection('schoolNotices').limit(40).get()),
    docs('authorities', () => db().collection('authorityReferrals').limit(40).get()),
    docs('amber', () => db().collection('emergency_alerts').where('type', '==', 'missing_child').limit(30).get()),
    docs('institutions', () => db().collection('institutions').limit(40).get()),
    docs('refunds', () => db().collection('refund_requests').limit(20).get()),
    docs('users', () => db().collection('users').limit(200).get()),
    db().doc('platform_settings/feature_flags').get().catch(() => null),
    docs('helplines', () => db().collection('helpline_config').limit(40).get()),
    db().doc('safety_desk/rota').get().catch(() => null),
  ]);

  const keep = (data: FirebaseFirestore.DocumentData) => inDeskScope(actor, rowScope(data));
  const openModeration = moderation.filter(doc => str(doc.data().status) !== 'approved' && str(doc.data().status) !== 'rejected');
  const safety = tickets.filter(doc => keep(doc.data()));
  const breaches = safety.filter(doc => {
    const status = str(doc.data().status);
    const due = num(doc.data().slaDueAt);
    return status !== 'solved' && status !== 'closed' && due > 0 && due < now;
  });
  const signupStamps = users.map(doc => num(doc.data().createdAt));
  const alertStamps = alerts.map(doc => num(doc.data().createdAt) || num(doc.data().publishedAt));
  const month = now - 30 * 24 * 60 * 60 * 1000;
  const week = now - 7 * 24 * 60 * 60 * 1000;
  const flagData = flagsSnap && 'data' in flagsSnap ? flagsSnap.data() ?? {} : {};

  const queues = {
    verification: verifications.filter(doc => keep(doc.data())).map(doc => ({
      id: doc.id,
      title: `Tier review ${str(doc.data().tier) || ''}`.trim(),
      detail: str(doc.data().method) || 'Waiting for review',
    })),
    merchants: merchants.filter(doc => keep(doc.data())).map(doc => ({
      id: doc.id,
      title: str(doc.data().name) || 'Merchant',
      detail: str(doc.data().contact) || 'Pending approval',
    })),
    community: community.filter(doc => keep(doc.data())).map(doc => ({
      id: doc.id,
      title: str(doc.data().orgName) || 'Community partner',
      detail: `${str(doc.data().type) || 'partner'} · ${str(doc.data().country) || 'country not set'}`,
    })),
    offers: offers.filter(doc => keep(doc.data())).map(doc => ({
      id: doc.id,
      title: str(doc.data().title) || 'Offer',
      detail: str(doc.data().category) || 'In review',
    })),
    moderation: openModeration.map(doc => ({
      id: doc.id,
      title: str(doc.data().surface) || 'Report',
      detail: str(doc.data().reason) || 'Open report',
    })),
    appeals: appeals.map(doc => ({
      id: doc.id,
      title: 'Appeal',
      detail: str(doc.data().note) || 'Waiting for a decision',
    })),
    safety: safety.map(doc => {
      const timer = slaRemaining(num(doc.data().slaDueAt), now);
      return {
        id: doc.id,
        title: visibleCaseTitle(str(doc.data().category) || 'Safety Desk ticket', actor, sensitive),
        detail: `${str(doc.data().status) || 'open'} · ${timer.label}`,
      };
    }),
    schools: notices.filter(doc => keep(doc.data())).map(doc => ({
      id: doc.id,
      title: visibleCaseTitle(str(doc.data().schoolName) || 'School notice', actor, sensitive),
      detail: str(doc.data().status) || 'draft',
    })),
    authorities: authorities.filter(doc => keep(doc.data())).map(doc => ({
      id: doc.id,
      title: visibleCaseTitle(str(doc.data().agency) || 'Authority referral', actor, sensitive),
      detail: str(doc.data().status) || 'draft',
    })),
    amber: alerts.filter(doc => str(doc.data().deskApproval) !== 'approved').map(doc => ({
      id: doc.id,
      title: 'Amber approval',
      detail: Array.isArray(doc.data().deskApprovers) ? `${doc.data().deskApprovers.length} of 2 approvals` : 'Needs two admins',
    })),
    institutions: institutions.filter(doc => str(doc.data().status) === 'pending' && keep(doc.data())).map(doc => ({
      id: doc.id,
      title: str(doc.data().name) || 'Institution',
      detail: str(doc.data().country) || 'Pending approval',
    })),
  };

  return {
    configured: true,
    comingSoon: false,
    staffRole: actor.staffRole,
    scope: isSuperDesk(actor) ? 'Platform' : (actor.institutionId || actor.region || actor.country || 'No scope set'),
    identityHidden: sensitive,
    counts: Object.fromEntries(Object.entries(queues).map(([id, rows]) => [id, rows.length])),
    queues,
    refunds: refunds.map(doc => ({
      id: doc.id,
      title: str(doc.data().status) || 'Refund request',
      detail: str(doc.data().reason) || str(doc.data().checkoutId) || doc.id,
    })),
    kpis: {
      signups: signupStamps.filter(stamp => stamp >= month).length,
      active: users.filter(doc => num(doc.data().lastActiveAt) >= week).length,
      revenue: 0,
      alerts: alerts.length,
      reports: openModeration.length + safety.length,
      slaBreaches: breaches.length,
    },
    series: {
      signups: bucketSeries(signupStamps, now),
      alerts: bucketSeries(alertStamps, now),
    },
    flags: FEATURE_FLAGS.map(flag => ({
      id: flag,
      on: typeof flagData[flag] === 'boolean' ? flagData[flag] === true : DEFAULT_FLAGS[flag],
    })),
    helplines: helplines.map(doc => ({
      id: doc.id,
      country: str(doc.data().country) || doc.id,
      name: str(doc.data().name),
      number: str(doc.data().number),
    })),
    rota: {
      timezone: rotaSnap && 'data' in rotaSnap ? str(rotaSnap.data()?.timezone) : '',
      slots: rotaSnap && 'data' in rotaSnap && Array.isArray(rotaSnap.data()?.slots) ? rotaSnap.data()?.slots.length ?? 0 : 0,
    },
    termsVersion: '2026-10-17',
  };
}

function emptyDesk(actor: DeskActor, comingSoon: boolean) {
  return {
    configured: !comingSoon,
    comingSoon,
    staffRole: actor.staffRole,
    scope: '',
    identityHidden: hideSafeguardingIdentity(actor),
    counts: {},
    queues: {},
    refunds: [],
    kpis: { signups: 0, active: 0, revenue: 0, alerts: 0, reports: 0, slaBreaches: 0 },
    series: { signups: [0, 0, 0, 0, 0, 0, 0], alerts: [0, 0, 0, 0, 0, 0, 0] },
    flags: FEATURE_FLAGS.map(flag => ({ id: flag, on: DEFAULT_FLAGS[flag] })),
    helplines: [],
    rota: { timezone: '', slots: 0 },
    termsVersion: '2026-10-17',
  };
}

async function targetUser(id: string) {
  const snap = await db().doc(`users/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'That account was not found.');
  return { id, data: snap.data() ?? {} };
}

export async function runDeskAction(actor: DeskActor, body: Record<string, unknown>) {
  if (!isAdminConfigured()) return { ok: false as const, comingSoon: true as const, message: 'This admin tool is coming soon.' };
  if (!canOpenDesk(actor)) throw new ActionError('FORBIDDEN', 'This account cannot use the admin desk.');
  const action = str(body.action);
  const id = str(body.id);
  const reason = str(body.reason);

  if (action === 'set-role') {
    const target = await targetUser(id);
    const next = str(body.staffRole) as StaffRole | '';
    const directory = (await docs('directory', () => db().collection('users').limit(200).get()))
      .map(doc => ({ id: doc.id, email: str(doc.data().email), role: str(doc.data().role), adminRole: str(doc.data().adminRole) }) as StaffProfile);
    const decision = decideRoleChange({
      actorId: actor.uid,
      actor: actor.staffRole,
      targetId: id,
      target: resolveStaffRole({ email: str(target.data.email), role: str(target.data.role), adminRole: str(target.data.adminRole) }),
      next: next || null,
      superAdminIds: superAdminIds(directory),
    });
    if (!decision.ok) throw new ActionError('FORBIDDEN', decision.error);
    if (!inDeskScope(actor, rowScope(target.data))) throw new ActionError('FORBIDDEN', 'That account is outside your institution or region.');
    if (!reason) throw new ActionError('BAD_REQUEST', 'A reason is required.');
    await db().doc(`users/${id}`).set({ adminRole: next, role: next ? 'admin' : str(target.data.role) || 'student' }, { merge: true });
    await audit(actor, 'set-role', id, { staffRole: next, reason });
    return { ok: true as const, granted: false as const };
  }

  if (action === 'suspend') {
    const target = await targetUser(id);
    const decision = decideSuspend({
      actor,
      targetStaffRole: resolveStaffRole({ email: str(target.data.email), role: str(target.data.role), adminRole: str(target.data.adminRole) }),
      targetInstitutionId: str(target.data.institutionId),
      targetRegion: str(target.data.region) || str(target.data.state),
      targetCountry: str(target.data.country),
      reason,
    });
    if (!decision.ok) throw new ActionError('FORBIDDEN', decision.error);
    await db().doc(`users/${id}`).set({ accountStatus: 'suspended', statusReason: reason }, { merge: true });
    await audit(actor, 'suspend', id, { reason });
    return { ok: true as const };
  }

  if (action === 'set-tier') {
    const target = await targetUser(id);
    const nextTier = Number(body.tier);
    const decision = decideTierChange({
      actor,
      targetStaffRole: resolveStaffRole({ email: str(target.data.email), role: str(target.data.role), adminRole: str(target.data.adminRole) }),
      targetInstitutionId: str(target.data.institutionId),
      targetRegion: str(target.data.region) || str(target.data.state),
      targetCountry: str(target.data.country),
      nextTier,
      reason,
    });
    if (!decision.ok) throw new ActionError('FORBIDDEN', decision.error);
    const current = readVerification(target.data.verification);
    if (nextTier < current.tier) throw new ActionError('BAD_REQUEST', 'A verification tier cannot be lowered here.');
    const next = raiseVerification(current, { tier: nextTier as 0 | 1 | 2 | 3 | 4, method: 'partner_review', verifiedAt: Date.now(), verifiedBy: actor.uid });
    await db().doc(`users/${id}`).set({ verification: next }, { merge: true });
    await audit(actor, 'set-tier', id, { tier: next.tier, reason });
    return { ok: true as const, tier: next.tier };
  }

  if (action === 'community-review') {
    if (!isSuperDesk(actor)) throw new ActionError('FORBIDDEN', 'A super admin reviews community partners.');
    const decision = body.decision === 'approved' || body.decision === 'declined' ? body.decision : '';
    if (!decision) throw new ActionError('BAD_REQUEST', 'Choose approve or decline.');
    const result = await reviewPartnerApplication(actor.uid, id, decision);
    await audit(actor, 'community-review', id, { decision, granted: false });
    return result;
  }

  if (action === 'merchant-review' || action === 'offer-review') {
    if (!isSuperDesk(actor)) throw new ActionError('FORBIDDEN', 'A super admin reviews merchants and offers.');
    const approve = body.status === 'approved' || body.status === 'live';
    if (action === 'merchant-review') await decidePartner(id, approve);
    else await decideOffer(id, approve);
    await audit(actor, action, id, { approve, reason });
    return { ok: true as const };
  }

  if (action === 'appeal') {
    const restore = body.restore === true;
    const result = await resolveAppeal(actor.uid, id, restore);
    await audit(actor, 'appeal', id, { restore, status: result.status });
    return { ok: true as const, status: result.status };
  }

  if (action === 'institution-approve') {
    const snap = await db().doc(`institutions/${id}`).get();
    if (!snap.exists) throw new ActionError('NOT_FOUND', 'That institution was not found.');
    if (!inDeskScope(actor, rowScope(snap.data() ?? {}))) throw new ActionError('FORBIDDEN', 'That institution is outside your institution or region.');
    if (!reason) throw new ActionError('BAD_REQUEST', 'A reason is required.');
    await snap.ref.set({ status: 'approved', approvedBy: actor.uid, approvedAt: Date.now() }, { merge: true });
    await finishAdminTask(`institutions/${id}`, actor.uid, 'done', reason);
    await audit(actor, 'institution-approve', id, { reason });
    return { ok: true as const };
  }

  if (action === 'amber-approve') {
    const snap = await db().doc(`emergency_alerts/${id}`).get();
    if (!snap.exists) throw new ActionError('NOT_FOUND', 'That alert was not found.');
    const existing = Array.isArray(snap.data()?.deskApprovers) ? snap.data()?.deskApprovers.filter((item: unknown): item is string => typeof item === 'string') : [];
    const decision = recordAmberApproval({ actorUid: actor.uid, reason, approvers: existing });
    if (!decision.ok) throw new ActionError('BAD_REQUEST', decision.error);
    await snap.ref.set({
      deskApprovers: decision.approvers,
      deskApproval: decision.ready ? 'approved' : 'pending',
    }, { merge: true });
    await audit(actor, 'amber-approve', id, { ready: decision.ready, reason });
    return { ok: true as const, ready: decision.ready };
  }

  if (action === 'flag') {
    if (!isSuperDesk(actor)) throw new ActionError('FORBIDDEN', 'Only a super admin can change a kill switch.');
    const flag = str(body.flag);
    if (!(FEATURE_FLAGS as readonly string[]).includes(flag)) throw new ActionError('BAD_REQUEST', 'That feature flag is not on the desk.');
    await db().doc('platform_settings/feature_flags').set({ [flag]: body.on === true }, { merge: true });
    await audit(actor, 'flag', flag, { on: body.on === true });
    return { ok: true as const };
  }

  if (action === 'broadcast') {
    const decision = confirmBroadcast({
      actor,
      category: str(body.category),
      audience: str(body.audience),
      body: str(body.body),
      confirmation: str(body.confirmation),
    });
    if (!decision.ok) throw new ActionError('BAD_REQUEST', decision.error);
    const ref = db().collection('push_broadcasts').doc();
    await ref.set({
      category: str(body.category),
      audience: str(body.audience),
      body: str(body.body),
      createdBy: actor.uid,
      createdAt: Date.now(),
      status: 'queued',
    });
    await audit(actor, 'broadcast', ref.id, { category: str(body.category), audience: str(body.audience) });
    return { ok: true as const, id: ref.id, status: 'queued' as const };
  }

  if (action === 'helpline') {
    const country = str(body.country).toUpperCase();
    const name = str(body.name);
    const number = str(body.number);
    const sourceUrl = str(body.sourceUrl);
    if (!/^[A-Z]{2}$/.test(country)) throw new ActionError('BAD_REQUEST', 'Use a two-letter country code.');
    if (!isSuperDesk(actor) && actor.country.toUpperCase() !== country) {
      throw new ActionError('FORBIDDEN', 'An admin can edit helplines for their own country.');
    }
    if (!name || !number) throw new ActionError('BAD_REQUEST', 'Add the helpline name and number.');
    if (sourceUrl && !/^https:\/\/[^\s]+$/i.test(sourceUrl)) throw new ActionError('BAD_REQUEST', 'A source page has to start with https://.');
    await db().doc(`helpline_config/${country}`).set({ country, name, number, sourceUrl, updatedBy: actor.uid, updatedAt: Date.now() }, { merge: true });
    await audit(actor, 'helpline', country, { name, number });
    return { ok: true as const };
  }

  if (action === 'rota') {
    if (!isSuperDesk(actor)) throw new ActionError('FORBIDDEN', 'Only a super admin edits the on-call rota.');
    const slots = Array.isArray(body.slots) ? body.slots.map(cleanSlot).filter((slot): slot is NonNullable<typeof slot> => slot !== null) : [];
    if (slots.length < 1) throw new ActionError('BAD_REQUEST', 'Add at least one on-call slot.');
    const timezone = str(body.timezone) || 'Asia/Kuala_Lumpur';
    await db().doc('safety_desk/rota').set({ timezone, slots, updatedBy: actor.uid, updatedAt: Date.now() }, { merge: true });
    await audit(actor, 'rota', 'safety_desk/rota', { slots: slots.length, timezone });
    return { ok: true as const, slots: slots.length };
  }

  if (action === 'terms-note') {
    if (!isSuperDesk(actor)) throw new ActionError('FORBIDDEN', 'Only a super admin can note a safety terms version.');
    const version = str(body.version);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) throw new ActionError('BAD_REQUEST', 'Use a version date.');
    if (!reason) throw new ActionError('BAD_REQUEST', 'A reason is required.');
    const ref = db().doc(`legal/safetyTerms/versions/${version}`);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ chainSeq: 0, chainHead: GENESIS, legalHold: emptyLegalHold(), version, statusNote: reason });
    } else {
      await ref.set({ statusNote: reason, notedBy: actor.uid, notedAt: Date.now() }, { merge: true });
    }
    await audit(actor, 'terms-note', version, { reason });
    return { ok: true as const };
  }

  throw new ActionError('NOT_FOUND', 'That admin action is not on the desk.');
}

export async function exportDeskLog(format: 'csv' | 'pdf', filter: { action?: string; actor?: string }) {
  if (!isAdminConfigured()) throw new ActionError('BAD_REQUEST', 'The activity export is coming soon.');
  await ensureLog();
  const parent = await db().doc('admin_desk/log').get();
  const snap = await db().collection('admin_desk/log/audit').orderBy('seq').limit(500).get();
  const action = (filter.action ?? '').toLowerCase();
  const actor = (filter.actor ?? '').toLowerCase();
  const entries = snap.docs
    .map(doc => doc.data() as ChainEntry)
    .filter(entry => !action || entry.action.toLowerCase().includes(action))
    .filter(entry => !actor || entry.actorUid.toLowerCase().includes(actor));
  const head = str(parent.data()?.chainHead) || GENESIS;
  return format === 'pdf'
    ? exportPdf('admin-desk', 'admin', entries, head)
    : exportCsv('admin-desk', 'admin', entries, head);
}

export async function searchDesk(actor: DeskActor, query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { users: [], institutions: [], tickets: [] };
  if (!isAdminConfigured()) return { users: [], institutions: [], tickets: [], comingSoon: true };
  const [users, institutions, tickets] = await Promise.all([
    docs('search-users', () => db().collection('users').limit(200).get()),
    docs('search-institutions', () => db().collection('institutions').limit(80).get()),
    docs('search-tickets', () => db().collection('hotline_tickets').limit(80).get()),
  ]);
  const hit = (parts: string[]) => parts.join(' ').toLowerCase().includes(q);
  return {
    users: users.filter(doc => inDeskScope(actor, rowScope(doc.data())) && hit([str(doc.data().name), str(doc.data().email)])).slice(0, 12).map(doc => ({
      id: doc.id,
      title: str(doc.data().name) || 'Account',
      detail: `${str(doc.data().role) || 'member'} · ${str(doc.data().email)}`,
    })),
    institutions: institutions.filter(doc => inDeskScope(actor, rowScope(doc.data())) && hit([str(doc.data().name), doc.id])).slice(0, 8).map(doc => ({
      id: doc.id,
      title: str(doc.data().name) || 'Institution',
      detail: str(doc.data().country),
    })),
    tickets: tickets.filter(doc => inDeskScope(actor, rowScope(doc.data())) && hit([doc.id, str(doc.data().category)])).slice(0, 8).map(doc => ({
      id: doc.id,
      title: visibleCaseTitle(str(doc.data().category) || doc.id, actor, true),
      detail: str(doc.data().status) || 'open',
    })),
  };
}
