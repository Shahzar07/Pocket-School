import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after as afterAll, before as beforeAll, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-poket';
const hostEnv = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const [host, portText] = hostEnv.split(':');

let env: RulesTestEnvironment;

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/student1'), {
      role: 'student', name: 'Harry Student', email: 'student@example.com', xp: 10, sparksBalance: 40,
    });
    await setDoc(doc(db, 'users/student2'), {
      role: 'student', name: 'Other Student', email: 'other@example.com', xp: 3, sparksBalance: 0,
    });
    await setDoc(doc(db, 'users/teacher1'), {
      role: 'teacher', name: 'Ada Teacher', email: 'teacher@example.com', xp: 0, sparksBalance: 0,
    });
    await setDoc(doc(db, 'users/admin1'), {
      role: 'admin', name: 'Admin', email: 'admin@example.com', xp: 0, sparksBalance: 0,
    });
    await setDoc(doc(db, 'users/parent1'), {
      role: 'parent', name: 'Pat Parent', email: 'parent@example.com', childIds: ['student1'],
    });
    await setDoc(doc(db, 'users/instadmin1'), {
      role: 'institution_admin', name: 'Inst Admin', email: 'inst@example.com', institutionId: 'school-a',
    });
    await setDoc(doc(db, 'daily_goals/goal1'), {
      studentId: 'student1', dateKey: '2026-10-15', title: 'Read', category: 'reading',
      estimateMinutes: 20, deadline: '18:00', status: 'not_started',
    });
    await setDoc(doc(db, 'analytics_snapshots/student_student1'), {
      scopeId: 'student1', subjectStudentId: 'student1', institutionId: 'school-a',
    });
    await setDoc(doc(db, 'integrity_cases/case1'), {
      studentId: 'student1', teacherId: 'teacher1', assignmentTitle: 'Essay',
      decision: 'pending', automaticPenalty: false, level: 'review', score: 40,
    });
    await setDoc(doc(db, 'published_reports/rc_public'), {
      studentName: 'Harry S.', courseTitle: 'Maths', grade: '8', termId: 't4', year: 2026,
      heading: 'IGCSE report', verificationToken: 'rc_public', issuer: 'PoketSchool.Ai',
    });
    await setDoc(doc(db, 'public_profiles/student1'), { displayName: 'Harry S.', role: 'student', xp: 10 });
    await setDoc(doc(db, 'lesson_notes/note1'), { userId: 'student1', body: 'private note' });
    await setDoc(doc(db, 'support_tickets/ticket1'), { userId: 'student1', subject: 'Help' });
    await setDoc(doc(db, 'announcements/news1'), {
      createdBy: 'teacher1', title: 'Trip', content: 'Friday', status: 'published',
      audience: 'all', priority: 'normal', pinned: false,
    });
    await setDoc(doc(db, 'courses/free1'), {
      ownerId: 'teacher1', title: 'Free class', status: 'published', kind: 'marketplace', price: 0, priceType: 'FREE',
    });
    await setDoc(doc(db, 'courses/paid1'), {
      ownerId: 'teacher1', title: 'Paid class', status: 'published', kind: 'marketplace',
      price: 99, priceType: 'MARKETPLACE_PURCHASE',
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host,
      port: Number(portText),
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

afterAll(async () => {
  await env.cleanup();
});

describe('profiles and Sparks', () => {
  it('lets a student read their own profile and not someone else\'s', async () => {
    const db = env.authenticatedContext('student1').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/student1')));
    await assertFails(getDoc(doc(db, 'users/student2')));
  });

  it('lets a student change their name and blocks Sparks, XP and child links', async () => {
    const db = env.authenticatedContext('student1').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/student1'), { name: 'Harry' }));
    await assertFails(updateDoc(doc(db, 'users/student1'), { sparksBalance: 9999 }));
    await assertFails(updateDoc(doc(db, 'users/student1'), { xp: 9999 }));
    await assertFails(updateDoc(doc(db, 'users/student1'), { childIds: ['student2'] }));
  });

  it('lets a new student create their own profile and blocks a Sparks balance', async () => {
    const db = env.authenticatedContext('newstudent', { email: 'newstudent@test.local' }).firestore();
    await assertSucceeds(setDoc(doc(db, 'users/newstudent'), {
      role: 'student', name: 'New Student', email: 'newstudent@test.local', xp: 0, sparksBalance: 0, emailVerified: false,
    }));
    await assertFails(setDoc(doc(db, 'users/newstudent2'), {
      role: 'student', name: 'Other', email: 'other@test.local', xp: 0, sparksBalance: 0, emailVerified: false,
    }));
    const rich = env.authenticatedContext('richstudent', { email: 'rich@test.local' }).firestore();
    await assertFails(setDoc(doc(rich, 'users/richstudent'), {
      role: 'student', name: 'Rich', email: 'rich@test.local', xp: 0, sparksBalance: 500, emailVerified: false,
    }));
  });

  it('lets anyone signed in read a public name and blocks XP edits', async () => {
    const db = env.authenticatedContext('student2').firestore();
    await assertSucceeds(getDoc(doc(db, 'public_profiles/student1')));
    const own = env.authenticatedContext('student1').firestore();
    await assertFails(updateDoc(doc(own, 'public_profiles/student1'), { xp: 500 }));
  });
});

describe('ownership', () => {
  it('hides another student\'s notes and tickets', async () => {
    const db = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(db, 'lesson_notes/note1')));
    await assertFails(getDoc(doc(db, 'support_tickets/ticket1')));
    const admin = env.authenticatedContext('admin1').firestore();
    await assertSucceeds(getDoc(doc(admin, 'support_tickets/ticket1')));
  });

  it('lets only the author edit an announcement', async () => {
    const stranger = env.authenticatedContext('student1').firestore();
    await assertFails(updateDoc(doc(stranger, 'announcements/news1'), { title: 'Changed' }));
    const author = env.authenticatedContext('teacher1').firestore();
    await assertSucceeds(updateDoc(doc(author, 'announcements/news1'), { title: 'Updated trip' }));
  });

  it('allows a free enrolment and refuses a paid one from the client', async () => {
    const db = env.authenticatedContext('student1').firestore();
    await assertSucceeds(setDoc(doc(db, 'courses/free1/enrollments/student1'), {
      studentId: 'student1', progress: 0, completedLessons: [],
    }));
    await assertFails(setDoc(doc(db, 'courses/paid1/enrollments/student1'), {
      studentId: 'student1', progress: 0, completedLessons: [],
    }));
  });
});

describe('goals, snapshots, integrity, and published reports', () => {
  const goal = {
    studentId: 'student1', dateKey: '2026-10-16', title: 'Practice', category: 'practice',
    estimateMinutes: 25, deadline: '17:00', status: 'not_started',
  };

  it('lets a student create their own goal and blocks another student or a Sparks award', async () => {
    const own = env.authenticatedContext('student1').firestore();
    await assertSucceeds(setDoc(doc(own, 'daily_goals/mine'), goal));
    await assertFails(setDoc(doc(own, 'daily_goals/theirs'), { ...goal, studentId: 'student2' }));
    await assertFails(setDoc(doc(own, 'daily_goals/bonus'), { ...goal, sparksAwarded: true }));
    await assertFails(updateDoc(doc(own, 'daily_goals/goal1'), { sparksAwarded: true }));
    await assertFails(updateDoc(doc(own, 'daily_goals/goal1'), { cosignedBy: 'student1' }));
    await assertSucceeds(updateDoc(doc(own, 'daily_goals/goal1'), { title: 'Read chapter 2' }));
  });

  it('lets a linked parent read and excuse a goal, and blocks delete or a completed status', async () => {
    const parent = env.authenticatedContext('parent1').firestore();
    await assertSucceeds(getDoc(doc(parent, 'daily_goals/goal1')));
    await assertSucceeds(updateDoc(doc(parent, 'daily_goals/goal1'), {
      status: 'excused', excuseReason: 'Ill', excusedBy: 'Pat Parent',
    }));
    await assertFails(updateDoc(doc(parent, 'daily_goals/goal1'), { status: 'completed' }));
    await assertFails(deleteDoc(doc(parent, 'daily_goals/goal1')));
    const stranger = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(stranger, 'daily_goals/goal1')));
  });

  it('keeps device tokens and snapshots off other clients', async () => {
    const own = env.authenticatedContext('student1').firestore();
    await assertSucceeds(setDoc(doc(own, 'deviceTokens/phone1'), {
      userId: 'student1', token: 'ExponentPushToken[abc]', platform: 'ios', provider: 'expo', prefs: { goals: true },
    }));
    await assertFails(getDoc(doc(own, 'deviceTokens/phone1')));
    const other = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(other, 'deviceTokens/phone1')));
    await assertFails(setDoc(doc(own, 'analytics_snapshots/student_student1'), { scopeId: 'student1', subjectStudentId: 'student1' }));
    await assertSucceeds(getDoc(doc(own, 'analytics_snapshots/student_student1')));
    const school = env.authenticatedContext('instadmin1').firestore();
    await assertSucceeds(getDoc(doc(school, 'analytics_snapshots/student_student1')));
  });

  it('lets a student appeal an integrity case and blocks a decision or an automatic penalty', async () => {
    const student = env.authenticatedContext('student1').firestore();
    await assertFails(updateDoc(doc(student, 'integrity_cases/case1'), { decision: 'dismissed' }));
    await assertSucceeds(updateDoc(doc(student, 'integrity_cases/case1'), {
      appealNote: 'I typed this myself.',
      appealAt: '2026-10-15T01:00:00.000Z',
      appealStatus: 'submitted',
    }));
    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertFails(setDoc(doc(teacher, 'integrity_cases/penalty'), {
      studentId: 'student1', teacherId: 'teacher1', automaticPenalty: true, decision: 'pending',
    }));
    await assertSucceeds(setDoc(doc(teacher, 'integrity_cases/open'), {
      studentId: 'student1', teacherId: 'teacher1', automaticPenalty: false, decision: 'pending',
    }));
  });

  it('lets anyone read one published report and blocks a list', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'published_reports/rc_public')));
    await assertFails(getDocs(collection(anon, 'published_reports')));
  });
});
