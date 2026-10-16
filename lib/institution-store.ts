/**
 * Firestore reads and writes for the institution console.
 * Decisions (who may see a tenant, CSV shape, plan limits) live in lib/enterprise.ts.
 */

import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  createInstitution, deleteInstitution, getInstitution, getInstitutions, listAcademyClasses,
  listAcademyInvites, listAcademyMembers, listOemLicences, saveAcademyClass, saveAcademyInvites,
  updateInstitution, type Institution,
} from './db';
import { omitUndefined } from './course-builder';
import {
  blankProfile, platformRoleForAcademy, type AcademyRole, type AuditEvent, type DirectoryRow,
  type InstitutionProfile, type InstitutionStatus, type LeadDraft, type LeadStatus,
} from './enterprise';
import { saveSchedule } from './insights/client';

export interface DemoLead extends LeadDraft {
  id: string;
  status: LeadStatus;
  createdAt?: string;
}

function profileFrom(data: Record<string, unknown> | undefined): InstitutionProfile {
  const address = (data?.address && typeof data.address === 'object' ? data.address : {}) as InstitutionProfile['address'];
  const contacts = Array.isArray(data?.contacts) ? data.contacts as InstitutionProfile['contacts'] : [];
  return blankProfile({
    type: data?.type === 'university' || data?.type === 'corporate' || data?.type === 'government' || data?.type === 'school' ? data.type : 'school',
    country: typeof data?.country === 'string' ? data.country : '',
    plan: data?.plan === 'starter' || data?.plan === 'team' || data?.plan === 'enterprise' || data?.plan === 'oem' ? data.plan : 'team',
    address,
    contacts,
    billingEmail: typeof data?.billingEmail === 'string' ? data.billingEmail : '',
    poNumber: typeof data?.poNumber === 'string' ? data.poNumber : '',
    seatCount: typeof data?.seatCount === 'number' ? data.seatCount : 0,
    seatsUsed: typeof data?.seatsUsed === 'number' ? data.seatsUsed : 0,
    licenceStartsOn: typeof data?.licenceStartsOn === 'string' ? data.licenceStartsOn : '',
    licenceEndsOn: typeof data?.licenceEndsOn === 'string' ? data.licenceEndsOn : '',
    renewalOn: typeof data?.renewalOn === 'string' ? data.renewalOn : '',
    amount: typeof data?.amount === 'number' ? data.amount : 0,
    currency: typeof data?.currency === 'string' ? data.currency : 'USD',
    parentInstitutionId: typeof data?.parentInstitutionId === 'string' ? data.parentInstitutionId : '',
    isolateData: data?.isolateData === true,
  });
}

function statusOf(value: unknown): InstitutionStatus {
  return value === 'suspended' || value === 'pending' || value === 'active' ? value : 'pending';
}

async function readProfile(id: string): Promise<InstitutionProfile> {
  const snap = await getDoc(doc(db, 'institutions', id, 'settings', 'profile'));
  return profileFrom(snap.exists() ? snap.data() as Record<string, unknown> : undefined);
}

export function directoryRow(institution: Institution, profile: InstitutionProfile): DirectoryRow {
  return {
    id: institution.id,
    name: institution.name,
    status: statusOf(institution.status),
    domain: institution.domain ?? '',
    subdomain: institution.subdomain ?? '',
    customDomain: institution.customDomain ?? '',
    profile: {
      ...profile,
      type: institution.type ?? profile.type,
      country: institution.country || profile.country,
      plan: institution.plan ?? profile.plan,
      parentInstitutionId: institution.parentInstitutionId || profile.parentInstitutionId,
      isolateData: institution.isolateData === true || profile.isolateData,
    },
  };
}

export async function loadDirectory(scopeId: string | null): Promise<DirectoryRow[]> {
  const institutions = scopeId
    ? [await getInstitution(scopeId)].filter((row): row is Institution => !!row)
    : await getInstitutions();
  return Promise.all(institutions.map(async (institution) => directoryRow(institution, await readProfile(institution.id))));
}

export async function loadProfile(id: string): Promise<InstitutionProfile> {
  return readProfile(id);
}

export async function createInstitutionBundle(input: {
  name: string;
  profile: InstitutionProfile;
  adminId: string;
}): Promise<string> {
  const id = await createInstitution({
    name: input.name.trim(),
    adminId: input.adminId,
    studentCount: 0,
    teacherCount: 0,
    status: 'pending',
    type: input.profile.type,
    country: input.profile.country,
    plan: input.profile.plan,
    ...(input.profile.parentInstitutionId ? { parentInstitutionId: input.profile.parentInstitutionId } : {}),
    isolateData: input.profile.isolateData,
  });
  await setDoc(doc(db, 'institutions', id, 'settings', 'profile'), omitUndefined(input.profile));
  return id;
}

export async function saveInstitutionPublic(id: string, patch: Partial<Institution>): Promise<void> {
  await updateInstitution(id, omitUndefined(patch));
}

export async function saveInstitutionProfile(id: string, profile: InstitutionProfile): Promise<void> {
  await setDoc(doc(db, 'institutions', id, 'settings', 'profile'), omitUndefined(profile), { merge: true });
  await updateInstitution(id, {
    type: profile.type,
    country: profile.country,
    plan: profile.plan,
    parentInstitutionId: profile.parentInstitutionId,
    isolateData: profile.isolateData,
  });
}

export async function setInstitutionStatus(id: string, status: InstitutionStatus): Promise<void> {
  await updateInstitution(id, { status });
}

export async function removeInstitution(id: string): Promise<void> {
  await deleteInstitution(id);
}

export async function recordAudit(institutionId: string, event: Omit<AuditEvent, 'at'>): Promise<void> {
  await addDoc(collection(db, 'institutions', institutionId, 'audit'), {
    ...omitUndefined(event),
    at: new Date().toISOString(),
  });
}

export async function listAudit(institutionId: string): Promise<AuditEvent[]> {
  const snap = await getDocs(query(collection(db, 'institutions', institutionId, 'audit'), orderBy('at', 'desc'), limit(100)));
  return snap.docs.map((row) => row.data() as AuditEvent);
}

export async function createDemoLead(draft: LeadDraft): Promise<string> {
  const ref = await addDoc(collection(db, 'demo_leads'), {
    name: draft.name.trim(),
    email: draft.email.trim().toLowerCase(),
    organisation: draft.organisation.trim(),
    country: draft.country.trim().toUpperCase(),
    type: draft.type,
    seats: draft.seats,
    message: draft.message.trim(),
    status: 'new',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listDemoLeads(status?: LeadStatus): Promise<DemoLead[]> {
  const mapLead = (id: string, data: Record<string, unknown>): DemoLead => ({
    id,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    organisation: String(data.organisation ?? ''),
    country: String(data.country ?? ''),
    type: data.type === 'university' || data.type === 'corporate' || data.type === 'government' ? data.type : 'school',
    seats: typeof data.seats === 'number' ? data.seats : 1,
    message: String(data.message ?? ''),
    status: data.status === 'contacted' || data.status === 'qualified' || data.status === 'demo' || data.status === 'won' || data.status === 'lost' ? data.status : 'new',
    createdAt: typeof data.createdAt?.toString === 'function' ? String(data.createdAt) : '',
  });
  try {
    const scoped = status
      ? query(collection(db, 'demo_leads'), where('status', '==', status), orderBy('createdAt', 'desc'), limit(100))
      : query(collection(db, 'demo_leads'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(scoped);
    return snap.docs.map((row) => mapLead(row.id, row.data()));
  } catch {
    const snap = await getDocs(query(collection(db, 'demo_leads'), limit(100)));
    return snap.docs
      .map((row) => mapLead(row.id, row.data()))
      .filter((lead) => !status || lead.status === status);
  }
}

export async function updateDemoLead(id: string, status: LeadStatus): Promise<void> {
  await updateDoc(doc(db, 'demo_leads', id), { status });
}

export async function recordPlatformAudit(event: Omit<AuditEvent, 'at'>): Promise<void> {
  await addDoc(collection(db, 'admin_audit'), { ...omitUndefined(event), at: new Date().toISOString() });
}

export interface CatalogueItem {
  id: string;
  kind: 'course' | 'book' | 'path';
  refId: string;
  title: string;
  visibility: 'private' | 'public';
}

export async function listCatalogue(institutionId: string): Promise<CatalogueItem[]> {
  const snap = await getDocs(collection(db, 'institutions', institutionId, 'catalogue'));
  return snap.docs.map((row) => ({ id: row.id, ...row.data() } as CatalogueItem));
}

export async function saveCatalogueItem(institutionId: string, item: Omit<CatalogueItem, 'id'> & { id?: string }): Promise<string> {
  const { id, ...data } = item;
  if (id) {
    await setDoc(doc(db, 'institutions', institutionId, 'catalogue', id), data, { merge: true });
    return id;
  }
  const ref = await addDoc(collection(db, 'institutions', institutionId, 'catalogue'), data);
  return ref.id;
}

export async function removeCatalogueItem(institutionId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'institutions', institutionId, 'catalogue', id));
}

export interface ComplianceItem {
  id: string;
  title: string;
  courseId: string;
  dueOn: string;
  remindDays: number;
  status: 'open' | 'done';
}

export async function listCompliance(institutionId: string): Promise<ComplianceItem[]> {
  try {
    const snap = await getDocs(query(
      collection(db, 'institutions', institutionId, 'compliance'),
      where('status', '==', 'open'),
      orderBy('dueOn', 'asc'),
      limit(100),
    ));
    const open = snap.docs.map((row) => ({ id: row.id, ...row.data() } as ComplianceItem));
    const doneSnap = await getDocs(query(
      collection(db, 'institutions', institutionId, 'compliance'),
      where('status', '==', 'done'),
      orderBy('dueOn', 'asc'),
      limit(100),
    ));
    return [...open, ...doneSnap.docs.map((row) => ({ id: row.id, ...row.data() } as ComplianceItem))];
  } catch {
    const snap = await getDocs(collection(db, 'institutions', institutionId, 'compliance'));
    return snap.docs.map((row) => ({ id: row.id, ...row.data() } as ComplianceItem));
  }
}

export async function saveCompliance(institutionId: string, item: Omit<ComplianceItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'institutions', institutionId, 'compliance'), item);
  return ref.id;
}

export interface InvoiceItem {
  id: string;
  number: string;
  amount: number;
  currency: string;
  seats: number;
  status: 'quote' | 'po' | 'open' | 'paid' | 'requested';
  poNumber: string;
  issuedOn: string;
}

export async function listInvoices(institutionId: string): Promise<InvoiceItem[]> {
  const snap = await getDocs(collection(db, 'institutions', institutionId, 'invoices'));
  return snap.docs.map((row) => ({ id: row.id, ...row.data() } as InvoiceItem));
}

export async function saveInvoice(institutionId: string, item: Omit<InvoiceItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'institutions', institutionId, 'invoices'), item);
  return ref.id;
}

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secretPrefix: string;
}

export async function listWebhooks(institutionId: string): Promise<WebhookItem[]> {
  const snap = await getDocs(collection(db, 'institutions', institutionId, 'webhooks'));
  return snap.docs.map((row) => ({ id: row.id, ...row.data() } as WebhookItem));
}

export async function saveWebhook(institutionId: string, item: Omit<WebhookItem, 'id'> & { secretHash: string }): Promise<string> {
  const ref = await addDoc(collection(db, 'institutions', institutionId, 'webhooks'), item);
  return ref.id;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
}

export async function listApiKeys(institutionId: string): Promise<ApiKeyItem[]> {
  const snap = await getDocs(collection(db, 'institutions', institutionId, 'api_keys'));
  return snap.docs.map((row) => ({ id: row.id, name: String(row.data().name ?? ''), prefix: String(row.data().prefix ?? '') }));
}

export async function saveApiKey(institutionId: string, item: { name: string; prefix: string; hash: string }): Promise<string> {
  const ref = await addDoc(collection(db, 'institutions', institutionId, 'api_keys'), item);
  return ref.id;
}

export interface LearningPathItem {
  id: string;
  name: string;
  items: string[];
}

export async function listPaths(institutionId: string): Promise<LearningPathItem[]> {
  const snap = await getDocs(collection(db, 'institutions', institutionId, 'learning_paths'));
  return snap.docs.map((row) => ({ id: row.id, ...row.data() } as LearningPathItem));
}

export async function savePath(institutionId: string, item: Omit<LearningPathItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'institutions', institutionId, 'learning_paths'), item);
  return ref.id;
}

export interface SkillItem {
  id: string;
  domain: string;
  name: string;
  level: string;
}

export async function listSkills(institutionId: string): Promise<SkillItem[]> {
  const snap = await getDocs(collection(db, 'institutions', institutionId, 'skills'));
  return snap.docs.map((row) => ({ id: row.id, ...row.data() } as SkillItem));
}

export async function saveSkills(institutionId: string, rows: Omit<SkillItem, 'id'>[]): Promise<void> {
  await Promise.all(rows.map((row) => addDoc(collection(db, 'institutions', institutionId, 'skills'), row)));
}

export async function savePeopleInvites(institutionId: string, rows: { email: string; name: string; academyRole: AcademyRole }[]): Promise<void> {
  await saveAcademyInvites(institutionId, rows.map((row) => ({
    email: row.email,
    name: row.name,
    role: platformRoleForAcademy(row.academyRole) === 'student' ? 'student' : 'teacher',
    academyRole: row.academyRole,
  })));
}

export async function loadPeople(institutionId: string) {
  const [members, invites, groups] = await Promise.all([
    listAcademyMembers(institutionId),
    listAcademyInvites(institutionId),
    listAcademyClasses(institutionId),
  ]);
  return { members, invites, groups };
}

export async function saveGroup(institutionId: string, group: { name: string; kind: string; programmeIds: string[] }): Promise<string> {
  return saveAcademyClass(institutionId, {
    name: group.name,
    programmeIds: group.programmeIds,
    memberIds: [],
    kind: group.kind === 'campus' || group.kind === 'department' || group.kind === 'group' ? group.kind : 'class',
  });
}

export async function scheduleInstitutionReport(input: {
  ownerId: string;
  institutionId: string;
  scopeLabel: string;
  cadence: 'weekly' | 'daily' | 'term';
  nextRun: string;
}): Promise<string> {
  return saveSchedule({
    ownerId: input.ownerId,
    role: 'institution_admin',
    cadence: input.cadence,
    metricIds: ['engagement', 'completions', 'seats'],
    scopeId: input.institutionId,
    scopeLabel: input.scopeLabel,
    institutionId: input.institutionId,
    nextRun: input.nextRun,
  });
}

export { listOemLicences, listAcademyInvites };
