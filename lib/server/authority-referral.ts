/**
 * Desk-sent referrals to a tier-4 partner or an official channel.
 * Nothing is emailed unless a Desk member sends it, and no address is guessed.
 */

import { createHash, randomBytes } from 'node:crypto';
import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { applyAuthorityUpdate, type AuthorityDecision } from '../authorities/policy';
import {
  DESK_NOT_EMERGENCY,
  authorityCaseMessage,
  channelsFor,
  decisionFromTicket,
  mandatoryReportingNote,
  partnerEligible,
  referralFamily,
  referralSummary,
} from '../bullying/authority-referral';
import { DESK_CONTACT, SAFETY_FROM } from '../bullying/school-notice';
import { bullyingReceiveAllowed, guardianIdsFor } from '../bullying/policy';
import { emergencyNumber } from '../emergency/policy';
import { originFromUrl, safetyMessageFooter } from '../safety/disclaimer';
import { GENESIS, emptyLegalHold, type ChainDevice } from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';
import { currentMailAdapter, sendWithBackoff } from '../mail';
import { casePdf } from '../moderation/pdf';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { tierOf } from './alert-directory';
import { ActionError } from './actions';
import { appendChain } from './ledger';

const TOKEN_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function origin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  return (configured || 'https://poketschool.ai').replace(/\/$/, '');
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface Actor {
  id: string;
  role: string;
  name: string;
  staffPost: string;
}

async function loadActor(uid: string): Promise<Actor> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const data = snap.data() ?? {};
  return {
    id: uid,
    role: str(data.role) || 'student',
    name: str(data.name) || 'Member',
    staffPost: str(data.staffPost),
  };
}

function deskLead(actor: Actor): boolean {
  return actor.role === 'admin' || actor.staffPost === 'safety_desk';
}

async function pushTo(uid: string, body: string, link: string) {
  if (!uid) return;
  try {
    await sendPush(
      { recipientUid: uid, category: 'safety', title: 'Safety Desk', body, link, force: true },
      { store: adminPushStore(), send: sendToDevice },
    );
  } catch (error) {
    console.error('authority referral push failed', error);
  }
}

async function logReferral(id: string, actor: { id: string; role: string }, action: string, after: Record<string, unknown>, device: ChainDevice = SERVER_DEVICE) {
  await appendChain({
    parentPath: `authorityReferrals/${id}`,
    collection: 'events',
    actorUid: actor.id,
    actorRole: actor.role,
    action,
    diff: { before: {}, after },
    device,
  });
}

async function logTicket(ticketId: string, actor: { id: string; role: string }, action: string, after: Record<string, unknown>, device: ChainDevice = SERVER_DEVICE) {
  const parent = await db().doc(`hotline_tickets/${ticketId}`).get();
  if (!parent.exists) return;
  await appendChain({
    parentPath: `hotline_tickets/${ticketId}`,
    collection: 'events',
    actorUid: actor.id,
    actorRole: actor.role,
    action,
    diff: { before: {}, after },
    device,
  });
}

async function loadTicket(reportId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) throw new ActionError('BAD_REQUEST', 'Choose a report.');
  const snap = await db().doc(`hotline_tickets/${reportId}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Report not found.');
  return snap;
}

function countryOf(data: FirebaseFirestore.DocumentData): string {
  return str(data.reporterCountry) || 'Malaysia';
}

export async function authorityOptions(uid: string, reportId: string) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  if (!deskLead(actor)) throw new ActionError('FORBIDDEN', 'The Safety Desk reviews an authority referral.');
  const snap = await loadTicket(reportId);
  const data = snap.data() ?? {};
  const text = `${str(data.safetyType)} ${str(data.body)} ${str(data.who)}`;
  const country = countryOf(data);
  const partners = await listPartnerRows(country, str(data.reporterRegion));
  const decision = decisionFromTicket(data.authorities);
  return {
    country,
    emergencyNumber: emergencyNumber(country),
    deskDoesNotReplaceEmergency: DESK_NOT_EMERGENCY,
    required: decision.required,
    status: decision.status,
    channels: channelsFor(country, text).map(row => ({
      id: row.id,
      agency: row.agency,
      how: row.how,
      sourceUrl: row.sourceUrl,
      phone: row.phone,
    })),
    mandatory: mandatoryReportingNote(country, text),
    partners: partners.map(row => ({ id: row.id, name: row.name, kind: row.kind, country: row.country })),
    authorityReferred: data.authorityTrackerVisible === true && Number(data.authorityReferredAt) > 0,
  };
}

interface PartnerRow {
  id: string;
  name: string;
  kind: string;
  country: string;
  email: string;
}

async function listPartnerRows(country: string, region: string): Promise<PartnerRow[]> {
  const [police, protection] = await Promise.all([
    db().collection('users').where('partnerKind', '==', 'police').limit(20).get(),
    db().collection('users').where('partnerKind', '==', 'child_protection').limit(20).get(),
  ]);
  const rows: PartnerRow[] = [];
  for (const doc of [...police.docs, ...protection.docs]) {
    const data = doc.data();
    const kind = str(data.partnerKind);
    if (!partnerEligible({
      tier: tierOf(data),
      partnerKind: kind,
      country: str(data.country) || str(data.homeCountry),
      region: str(data.state),
      wantedCountry: country,
      wantedRegion: region,
    })) continue;
    const email = str(data.email).toLowerCase();
    rows.push({
      id: doc.id,
      name: str(data.name) || 'Partner',
      kind,
      country: str(data.country) || str(data.homeCountry),
      email: EMAIL.test(email) ? email : '',
    });
  }
  return rows;
}

export async function recordAuthorityDecision(uid: string, input: Record<string, unknown>) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  if (!deskLead(actor)) throw new ActionError('FORBIDDEN', 'The Safety Desk records this decision.');
  const snap = await loadTicket(str(input.reportId));
  const current = (snap.data()?.authorities ?? { required: 'unsure', reason: '', status: 'to_be_informed', informed: null }) as AuthorityDecision;
  const choice = str(input.decision);
  const now = Date.now();
  if (choice === 'not_needed') {
    const next = applyAuthorityUpdate(current, {
      status: 'not_required',
      reason: str(input.reason),
      agency: '',
      contact: '',
      reference: '',
      by: actor.id,
      at: now,
    });
    if ('error' in next) throw new ActionError('BAD_REQUEST', next.error);
    await snap.ref.set({ authorities: next.decision, authoritiesRemindedAt: now, updatedAt: now }, { merge: true });
    await logTicket(snap.id, actor, 'authorities', { status: 'not_required', required: 'no' });
    return { status: 'not_required' as const };
  }
  if (choice !== 'refer') throw new ActionError('BAD_REQUEST', 'Choose refer, or not needed.');
  const decision: AuthorityDecision = { required: 'yes', reason: '', status: 'to_be_informed', informed: current.informed };
  await snap.ref.set({ authorities: decision, authoritiesRemindedAt: 0, updatedAt: now }, { merge: true });
  await logTicket(snap.id, actor, 'authorities', { status: 'to_be_informed', required: 'yes' });
  return { status: 'to_be_informed' as const };
}

async function familyPlan(data: FirebaseFirestore.DocumentData, input: Record<string, unknown>) {
  const abuse = str(data.safetyType) === 'abuse' || str(data.concernRole) === 'parent' || str(data.concernRole) === 'guardian';
  return referralFamily({
    parentsExcluded: data.parentsExcluded === true || data.dontTellParents === true,
    abuseByParent: abuse || data.parentsExcluded === true,
    withholdStudent: input.withholdStudent === true,
    withholdReason: str(input.withholdReason),
  });
}

async function evidenceAttachment(evidenceId: string, reporterName: string, now: number) {
  if (!evidenceId) return [] as { filename: string; content: string }[];
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(evidenceId)) throw new ActionError('BAD_REQUEST', 'That evidence cannot be attached.');
  const evidence = await db().doc(`evidence_locker/${evidenceId}`).get();
  if (!evidence.exists) throw new ActionError('BAD_REQUEST', 'That evidence cannot be attached.');
  const note = str(evidence.data()?.note);
  if (reporterName && note.toLowerCase().includes(reporterName.toLowerCase())) {
    throw new ActionError('BAD_REQUEST', 'That evidence names the reporter. Leave it off the referral.');
  }
  const bytes = casePdf([
    'Poket School evidence record',
    `Platform: ${str(evidence.data()?.platform) || 'other'}`,
    `Recorded: ${new Date(Number(evidence.data()?.createdAt) || now).toISOString()}`,
    `SHA-256: ${str(evidence.data()?.hash)}`,
    note.slice(0, 100),
    'The reporter is not named.',
  ]);
  return [{ filename: 'poket-school-evidence.pdf', content: Buffer.from(bytes).toString('base64') }];
}

export async function sendAuthorityReferral(uid: string, input: Record<string, unknown>) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  if (!deskLead(actor)) throw new ActionError('FORBIDDEN', 'The Safety Desk sends an authority referral.');
  if (input.send !== true) throw new ActionError('BAD_REQUEST', 'A Desk member has to send this. Nothing is sent automatically.');
  const snap = await loadTicket(str(input.reportId));
  const data = snap.data() ?? {};
  const reporter = await db().doc(`users/${str(data.reporterUid)}`).get();
  const reporterName = str(reporter.data()?.name);
  const summary = referralSummary(str(input.summary), reporterName);
  if (!summary.ok) throw new ActionError('BAD_REQUEST', summary.error);
  const family = await familyPlan(data, input);
  if (!family.ok) throw new ActionError('BAD_REQUEST', family.error);
  const country = countryOf(data);
  const text = `${str(data.safetyType)} ${str(data.body)} ${summary.summary}`;
  const channelId = str(input.channelId);
  const partnerId = str(input.partnerId);
  const now = Date.now();
  const token = randomBytes(24).toString('hex');
  const caseUrl = `${origin()}/authority-case/${token}`;
  let agency = '';
  let contact = '';
  let channel = '';
  let email = '';
  let partnerUid = '';
  if (partnerId) {
    const partners = await listPartnerRows(country, str(data.reporterRegion));
    const partner = partners.find(row => row.id === partnerId);
    if (!partner) throw new ActionError('BAD_REQUEST', 'That partner is not a verified tier-4 police or child-protection account in this country.');
    agency = partner.name;
    contact = 'Poket School partner';
    channel = 'partner';
    email = partner.email;
    partnerUid = partner.id;
  } else {
    const official = channelsFor(country, text).find(row => row.id === channelId);
    if (!official) throw new ActionError('BAD_REQUEST', 'No verified official channel is on file for this country. The task is to find the official page. Do not guess an email.');
    const reference = str(input.reference);
    if (reference.length < 2) throw new ActionError('BAD_REQUEST', 'Record the reference from the official channel.');
    agency = official.agency;
    contact = official.sourceUrl;
    channel = official.kind;
  }
  const reference = str(input.reference) || `PS-${token.slice(0, 8)}`;
  const attachments = await evidenceAttachment(str(input.evidenceId), reporterName, now);
  if (email) {
    const message = authorityCaseMessage({
      agency,
      incidentType: str(data.safetyType) || 'safeguarding',
      dates: str(data.when),
      summary: summary.summary,
      caseUrl,
    });
    if (reporterName && message.text.toLowerCase().includes(reporterName.toLowerCase())) {
      throw new ActionError('BAD_REQUEST', 'Take the reporter’s name out of the referral.');
    }
    const mailed = await sendWithBackoff(() => currentMailAdapter().send({
      to: email,
      from: SAFETY_FROM,
      subject: message.subject,
      text: message.text,
      html: message.text.split('\n').map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join(''),
      attachments,
    }));
    if (!mailed.ok) throw new ActionError('BAD_REQUEST', 'The referral was not sent. No email left this desk.');
  }
  const ref = db().collection('authorityReferrals').doc();
  await ref.set({
    reportId: snap.id,
    country,
    agency,
    partnerId: partnerUid,
    channel,
    sentBy: actor.id,
    sentAt: now,
    reference,
    status: 'sent',
    outcome: '',
    contact,
    summary: summary.summary,
    incidentType: str(data.safetyType) || 'safeguarding',
    dates: str(data.when).slice(0, 200),
    token,
    tokenHash: tokenHash(token),
    tokenExpiresAt: now + TOKEN_MS,
    chainSeq: 0,
    chainHead: GENESIS,
    legalHold: emptyLegalHold(),
    createdAt: now,
    updatedAt: now,
  });
  await logReferral(ref.id, actor, 'authority_referral_sent', {
    reportId: snap.id,
    agency,
    channel,
    reporterHidden: true,
  });
  if (partnerUid && !email) {
    await pushTo(partnerUid, 'A confidential case is waiting. The reporter is not named.', caseUrl);
  }
  const informed = applyAuthorityUpdate(
    { required: 'yes', reason: '', status: 'to_be_informed', informed: null },
    { status: 'informed', reason: '', agency, contact, reference, by: actor.id, at: now },
  );
  if ('error' in informed) throw new ActionError('BAD_REQUEST', informed.error);
  await snap.ref.set({
    authorities: informed.decision,
    authoritiesRemindedAt: now,
    authorityReferredAt: now,
    authorityTrackerVisible: family.trackerVisible,
    updatedAt: now,
  }, { merge: true });
  await logTicket(snap.id, actor, 'authority_referral', {
    referralId: ref.id,
    agency,
    channel,
    trackerVisible: family.trackerVisible,
    reporterHidden: true,
  });
  if (!family.tellStudent) {
    await logTicket(snap.id, actor, 'authority_referral_withhold', { reason: str(input.withholdReason).slice(0, 500) });
    await logReferral(ref.id, actor, 'authority_referral_withhold', { reason: str(input.withholdReason).slice(0, 500) });
  }
  const number = emergencyNumber(country);
  const told = `The Safety Desk has referred this report to the authorities. If you are in danger, call ${number}. ${DESK_NOT_EMERGENCY}`;
  if (family.tellStudent) await pushTo(str(data.reporterUid), told, '/dashboard/student/safety');
  if (family.tellGuardians) {
    const guardians = await guardianIds(str(data.reporterUid), data);
    for (const id of guardians) await pushTo(id, told, '/dashboard/parent');
  }
  const pack = partnerUid ? '' : [
    `Agency: ${agency}`,
    `Official page: ${contact}`,
    `Incident type: ${str(data.safetyType) || 'safeguarding'}`,
    `Dates: ${str(data.when)}`,
    `Summary: ${summary.summary}`,
    `Reference: ${reference}`,
    'The reporter is not named.',
    DESK_NOT_EMERGENCY,
    '',
    safetyMessageFooter(number, originFromUrl(caseUrl)),
  ].join('\n');
  return {
    id: ref.id,
    status: 'sent' as const,
    channel,
    caseUrl: partnerUid ? caseUrl : '',
    pack,
    trackerVisible: family.trackerVisible,
  };
}

async function guardianIds(studentId: string, ticket: FirebaseFirestore.DocumentData): Promise<string[]> {
  if (!studentId) return [];
  const linkSnap = await db().collection('parent_links').where('studentId', '==', studentId).limit(20).get();
  const links = [];
  for (const doc of linkSnap.docs) {
    const parentId = str(doc.data().parentId);
    if (!parentId) continue;
    const parent = await db().doc(`users/${parentId}`).get();
    links.push({ parentId, status: str(doc.data().status), tier: tierOf(parent.data()) });
  }
  const reporter = await db().doc(`users/${studentId}`).get();
  const ageTier = str(reporter.data()?.ageTier);
  return guardianIdsFor({
    under18: ageTier === 'under13' || ageTier === 'teen',
    links,
    exclusion: {
      type: str(ticket.safetyType),
      who: str(ticket.who),
      concernRole: str(ticket.concernRole),
      dontTellParents: ticket.dontTellParents === true || ticket.parentsExcluded === true,
    },
  }).ids;
}

export async function readPublicAuthorityCase(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const snap = await db().collection('authorityReferrals').where('tokenHash', '==', tokenHash(token)).limit(1).get();
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  if ((Number(data.tokenExpiresAt) || 0) <= Date.now()) return { expired: true as const };
  return {
    expired: false as const,
    agency: str(data.agency),
    country: str(data.country),
    incidentType: str(data.incidentType),
    dates: str(data.dates),
    summary: str(data.summary),
    reference: str(data.reference),
    status: str(data.status),
    deskContact: DESK_CONTACT,
    reporterHidden: true as const,
  };
}

export async function recordAuthorityOutcome(uid: string, input: Record<string, unknown>) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  if (!deskLead(actor)) throw new ActionError('FORBIDDEN', 'The Safety Desk records the outcome.');
  const id = str(input.id);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ActionError('BAD_REQUEST', 'Choose a referral.');
  const snap = await db().doc(`authorityReferrals/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Referral not found.');
  const outcome = str(input.outcome).slice(0, 500);
  if (outcome.length < 2) throw new ActionError('BAD_REQUEST', 'Write the outcome.');
  const now = Date.now();
  await snap.ref.set({ outcome, status: 'acknowledged', updatedAt: now }, { merge: true });
  await logReferral(id, actor, 'authority_referral_outcome', { outcome });
  return { ok: true };
}
