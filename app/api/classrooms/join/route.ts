import { NextResponse } from 'next/server';
import { adminAuth, adminDb, isAdminConfigured } from '@/lib/firebase-admin';

function under18(dob: string): boolean {
  const born = Date.parse(dob);
  if (!Number.isFinite(born)) return false;
  return (Date.now() - born) / (365.25 * 24 * 3600 * 1000) < 18;
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Classroom join needs the server account.' }, { status: 503 });
  }
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Sign in to join a classroom.' }, { status: 401 });
  let uid = '';
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: 'Sign in to join a classroom.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { code?: unknown };
  const code = String(body.code || '').trim().toUpperCase();
  if (code.length < 4) return NextResponse.json({ error: 'Enter the class code.' }, { status: 400 });

  const db = adminDb();
  const found = await db.collection('school_classes').where('joinCode', '==', code).limit(1).get();
  const klass = found.docs[0];
  if (!klass) return NextResponse.json({ error: 'That code does not match a classroom.' }, { status: 404 });
  const data = klass.data();
  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.data() ?? {};
  const name = typeof user.displayName === 'string' && user.displayName
    ? user.displayName
    : typeof user.name === 'string' && user.name
      ? user.name
      : 'Student';
  const minor = under18(typeof user.dateOfBirth === 'string' ? user.dateOfBirth : '');
  const institutionId = typeof data.institutionId === 'string' ? data.institutionId : '';
  const school = data.institutionKind === 'school' || (data.institutionKind !== 'independent' && data.visibility !== 'private' && institutionId.length > 0);
  const member = typeof user.institutionId === 'string'
    && user.institutionId === institutionId
    && (user.institutionAccess === 'active' || user.membershipStatus === 'active');
  const blocked = minor && school && !member;
  const auto = !blocked && data.inviteAutoApprove === true;
  const status = auto ? 'active' : 'pending';
  const existing = await db.collection('school_enrolments').where('studentId', '==', uid).limit(40).get();
  const prior = existing.docs.find((row) => row.data().classId === klass.id);
  if (prior) {
    return NextResponse.json({
      classId: klass.id,
      className: typeof data.name === 'string' ? data.name : 'Classroom',
      status: prior.data().status === 'active' ? 'active' : 'pending',
    });
  }
  const id = `enrol-${uid.slice(0, 10)}-${klass.id.slice(0, 12)}`.replace(/[^a-zA-Z0-9_-]/g, '');
  await db.collection('school_enrolments').doc(id).set({
    classId: klass.id,
    studentId: uid,
    studentName: name,
    status,
    joinMethod: 'code',
    under18: minor,
    institutionMember: member,
    holdReason: blocked
      ? 'Under 18s join only as members of the school.'
      : auto
        ? ''
        : 'Waiting for the teacher or the school to approve.',
    ownerTeacherId: typeof data.ownerTeacherId === 'string' ? data.ownerTeacherId : '',
    institutionId,
    className: typeof data.name === 'string' ? data.name : '',
  });
  return NextResponse.json({
    classId: klass.id,
    className: typeof data.name === 'string' ? data.name : 'Classroom',
    status,
  });
}
