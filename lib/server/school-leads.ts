import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { hasAccountRole } from '../account-modes';
import {
  DEFAULT_SCHOOL_STRIP_MINIMUM,
  schoolDisplayName,
  schoolKey,
  schoolStripMinimum,
  visibleSchoolNames,
  type SchoolLead,
} from '../self-reported-school';
import { ActionError } from './actions';

function db(): Firestore {
  return adminDb();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const SETTINGS = 'platform_settings/school_strip';

function leadFrom(id: string, data: FirebaseFirestore.DocumentData | undefined): SchoolLead {
  return {
    key: id,
    name: schoolDisplayName(data?.name) || id,
    country: text(data?.country).toUpperCase(),
    state: text(data?.state),
    count: Math.max(0, Math.round(Number(data?.count ?? 0))),
    alumniCount: Math.max(0, Math.round(Number(data?.alumniCount ?? 0))),
    registeredInstitutionId: text(data?.registeredInstitutionId),
    approvedForLanding: data?.approvedForLanding === true,
    mergedInto: text(data?.mergedInto),
  };
}

export async function readSchoolStripMinimum(): Promise<number> {
  const snap = await db().doc(SETTINGS).get();
  return schoolStripMinimum(snap.data()?.minimum ?? DEFAULT_SCHOOL_STRIP_MINIMUM);
}

export async function recordSelfReportedSchool(
  uid: string,
  input: { name: string; country: string; state: string },
): Promise<{ key: string; name: string; country: string; state: string }> {
  const name = schoolDisplayName(input.name);
  const country = text(input.country).toUpperCase().slice(0, 2);
  const state = text(input.state).slice(0, 80);
  const key = schoolKey(country, state, name);
  if (!key) throw new ActionError('VALIDATION', 'Enter the school name.');

  const userRef = db().doc(`users/${uid}`);
  const existing = await userRef.get();
  if (!existing.exists) throw new ActionError('USER_NOT_FOUND', 'Account not found.');
  const profile = existing.data() ?? {};
  if (!hasAccountRole({ role: profile.role, roles: profile.roles }, 'student')) {
    throw new ActionError('FORBIDDEN', 'Self-reported schools are stored on student accounts.');
  }
  if (text(profile.institutionId)) {
    throw new ActionError('VALIDATION', 'A verified institution membership is separate from a self-reported school.');
  }

  const saved = await db().runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const user = userSnap.data() ?? {};
    const previousRaw = user.selfReportedSchool && typeof user.selfReportedSchool === 'object'
      ? text((user.selfReportedSchool as { key?: string }).key)
      : '';
    const nextRef = db().doc(`unregistered_schools/${key}`);
    const previousRef = previousRaw && previousRaw !== key ? db().doc(`unregistered_schools/${previousRaw}`) : null;
    const nextSnap = await tx.get(nextRef);
    const previousSnap = previousRef ? await tx.get(previousRef) : null;
    let targetKey = key;
    let targetRef = nextRef;
    let targetSnap = nextSnap;
    const mergedInto = text(nextSnap.data()?.mergedInto);
    if (mergedInto && mergedInto !== key) {
      targetKey = mergedInto;
      targetRef = db().doc(`unregistered_schools/${mergedInto}`);
      targetSnap = await tx.get(targetRef);
    }
    if (previousRaw === targetKey) {
      const currentName = schoolDisplayName((user.selfReportedSchool as { name?: string }).name) || name;
      return { key: targetKey, name: currentName, country, state };
    }
    const display = schoolDisplayName(targetSnap.data()?.name) || name;
    const count = Math.max(0, Math.round(Number(targetSnap.data()?.count ?? 0))) + 1;
    if (previousRef && previousSnap?.exists && previousRaw !== targetKey) {
      const left = Math.max(0, Math.round(Number(previousSnap.data()?.count ?? 0)) - 1);
      tx.set(previousRef, { count: left, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    tx.set(targetRef, {
      name: display,
      country: text(targetSnap.data()?.country).toUpperCase() || country,
      state: text(targetSnap.data()?.state) || state,
      count,
      approvedForLanding: targetSnap.data()?.approvedForLanding === true,
      updatedAt: FieldValue.serverTimestamp(),
      ...(targetSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    tx.set(userRef, {
      selfReportedSchool: { name: display, key: targetKey, country, state },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { key: targetKey, name: display, country, state };
  });
  try {
    const { reconcileUser } = await import('./insight-counters');
    await reconcileUser(uid);
  } catch (error) {
    console.error('insight school counter skipped', error);
  }
  return saved;
}

export async function listSchoolLeads(): Promise<{ minimum: number; leads: SchoolLead[] }> {
  const [minimum, snap] = await Promise.all([
    readSchoolStripMinimum(),
    db().collection('unregistered_schools').limit(300).get(),
  ]);
  const leads = snap.docs
    .map((row) => leadFrom(row.id, row.data()))
    .filter((lead) => !lead.mergedInto)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { minimum, leads };
}

export async function setSchoolStripMinimum(value: unknown): Promise<number> {
  const minimum = schoolStripMinimum(value);
  await db().doc(SETTINGS).set({ minimum, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return minimum;
}

export async function setSchoolLandingApproval(key: string, approved: boolean): Promise<void> {
  const id = text(key);
  const ref = db().doc(`unregistered_schools/${id}`);
  const snap = await ref.get();
  if (!snap.exists || text(snap.data()?.mergedInto)) {
    throw new ActionError('NOT_FOUND', 'School lead not found.');
  }
  await ref.set({ approvedForLanding: approved, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function mergeSchoolLeads(keepKey: string, dropKey: string): Promise<SchoolLead> {
  const keep = text(keepKey);
  const drop = text(dropKey);
  if (!keep || !drop || keep === drop) throw new ActionError('VALIDATION', 'Choose two different school names to merge.');
  const keepRef = db().doc(`unregistered_schools/${keep}`);
  const dropRef = db().doc(`unregistered_schools/${drop}`);
  const merged = await db().runTransaction(async (tx) => {
    const [keepSnap, dropSnap] = await Promise.all([tx.get(keepRef), tx.get(dropRef)]);
    if (!keepSnap.exists || !dropSnap.exists) throw new ActionError('NOT_FOUND', 'School lead not found.');
    if (text(keepSnap.data()?.mergedInto) || text(dropSnap.data()?.mergedInto)) {
      throw new ActionError('VALIDATION', 'That school was already merged.');
    }
    const keepLead = leadFrom(keep, keepSnap.data());
    const dropLead = leadFrom(drop, dropSnap.data());
    const count = keepLead.count + dropLead.count;
    const alumniCount = keepLead.alumniCount + dropLead.alumniCount;
    tx.set(keepRef, {
      count,
      alumniCount,
      approvedForLanding: keepLead.approvedForLanding,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(dropRef, {
      count: 0,
      approvedForLanding: false,
      mergedInto: keep,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ...keepLead, count, alumniCount };
  });
  const students = await db().collection('users').where('selfReportedSchool.key', '==', drop).get();
  const batchSize = 400;
  for (let index = 0; index < students.docs.length; index += batchSize) {
    const batch = db().batch();
    for (const row of students.docs.slice(index, index + batchSize)) {
      const school = row.data().selfReportedSchool as { country?: string; state?: string } | undefined;
      batch.set(row.ref, {
        selfReportedSchool: {
          name: merged.name,
          key: keep,
          country: text(school?.country),
          state: text(school?.state),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  }
  return merged;
}

export async function publicSchoolStrip(): Promise<{ names: string[]; minimum: number }> {
  const [minimum, schools, institutions] = await Promise.all([
    readSchoolStripMinimum(),
    db().collection('unregistered_schools').limit(300).get(),
    db().collection('institutions').where('showOnSchoolStrip', '==', true).limit(100).get(),
  ]);
  const names = visibleSchoolNames({
    minimum,
    unregistered: schools.docs.map((row) => {
      const lead = leadFrom(row.id, row.data());
      return { name: lead.name, count: lead.count, approved: lead.approvedForLanding, mergedInto: lead.mergedInto };
    }),
    institutions: institutions.docs
      .filter((row) => row.data().status !== 'suspended')
      .map((row) => {
        const data = row.data();
        const branding = data.branding && typeof data.branding === 'object' ? data.branding as { displayName?: string } : {};
        return { name: schoolDisplayName(branding.displayName) || schoolDisplayName(data.name), optedIn: true };
      }),
  });
  return { names, minimum };
}
