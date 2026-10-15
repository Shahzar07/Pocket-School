import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

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

describe('certificates', () => {
  it('lets the public read a certificate and blocks every client write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'certificates/cert-1'), {
        studentId: 'student1',
        studentName: 'Harry Student',
        courseId: 'free1',
        courseTitle: 'Biology',
        moduleId: 'mod1',
        moduleTitle: 'Cells',
        issuedBy: 'poket-school',
        issuedByName: 'Poket School',
      });
    });
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'certificates/cert-1')));

    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertFails(setDoc(doc(teacher, 'certificates/forged'), {
      studentId: 'student2',
      studentName: 'Forged Name',
      courseId: 'free1',
      courseTitle: 'Biology',
      moduleTitle: 'Cells',
      issuedBy: 'teacher1',
      issuedByName: 'Ada Teacher',
    }));
    await assertFails(updateDoc(doc(teacher, 'certificates/cert-1'), { studentName: 'Changed' }));

    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(getDocs(query(collection(student, 'certificates'), where('studentId', '==', 'student1'))));
    await assertFails(setDoc(doc(student, 'certificates/self-made'), {
      studentId: 'student1',
      studentName: 'Harry Student',
      courseId: 'free1',
      courseTitle: 'Biology',
    }));
    await assertFails(setDoc(doc(student, 'certificate_keys/student1__free1__mod1'), {
      certificateId: 'cert-1',
    }));

    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/parent1'), {
        role: 'parent', name: 'Parent', email: 'parent@example.com', childIds: ['student1'], xp: 0, sparksBalance: 0,
      });
    });
    const parent = env.authenticatedContext('parent1').firestore();
    await assertSucceeds(getDocs(query(collection(parent, 'certificates'), where('studentId', '==', 'student1'))));
    const stranger = env.authenticatedContext('student2').firestore();
    await assertFails(getDocs(query(collection(stranger, 'certificates'), where('studentId', '==', 'student1'))));
  });
});
