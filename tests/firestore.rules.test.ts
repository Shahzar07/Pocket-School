import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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

describe('age tiers', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const people: [string, Record<string, unknown>][] = [
        ['child1', { role: 'student', name: 'Mina', ageTier: 'under13', yearGroup: '', subjects: [], xp: 0, sparksBalance: 0 }],
        ['child2', { role: 'student', name: 'Milo', ageTier: 'under13', xp: 0, sparksBalance: 0 }],
        ['teen1', { role: 'student', name: 'Noor', ageTier: 'teen', yearGroup: 'Year 10', subjects: ['Maths'], xp: 0, sparksBalance: 0 }],
        ['teen2', { role: 'student', name: 'Eli', ageTier: 'teen', yearGroup: 'Year 11', subjects: ['English'], xp: 0, sparksBalance: 0 }],
        ['adult1', { role: 'student', name: 'Ava', ageTier: 'adult', xp: 0, sparksBalance: 0 }],
        ['adult2', { role: 'student', name: 'Owen', ageTier: 'adult', xp: 0, sparksBalance: 0 }],
        ['teacherA', { role: 'teacher', name: 'Tess', ageTier: 'adult', xp: 0, sparksBalance: 0 }],
        ['teacherB', { role: 'teacher', name: 'Theo', ageTier: 'adult', xp: 0, sparksBalance: 0 }],
        ['parent1', { role: 'parent', name: 'Pat', ageTier: 'adult', childIds: ['child1'], xp: 0, sparksBalance: 0 }],
      ];
      for (const [id, data] of people) await setDoc(doc(db, `users/${id}`), data);

      await setDoc(doc(db, 'community_profiles/child1'), { ageTier: 'under13', displayName: 'Mina' });
      await setDoc(doc(db, 'community_profiles/teen1'), { ageTier: 'teen', displayName: 'Noor' });
      await setDoc(doc(db, 'community_profiles/adult1'), { ageTier: 'adult', displayName: 'Ava', adultDmOptIn: true, isPublic: true });
      await setDoc(doc(db, 'community_profiles/adult3'), { ageTier: 'adult', displayName: 'Noa', adultDmOptIn: true, isPublic: true });
      await setDoc(doc(db, 'users/adult3'), { role: 'student', name: 'Noa', ageTier: 'adult', xp: 0, sparksBalance: 0 });
      await setDoc(doc(db, 'community_profiles/adult2'), { ageTier: 'adult', displayName: 'Owen', adultDmOptIn: false });
      await setDoc(doc(db, 'public_profiles/child1'), { displayName: 'Mina', ageTier: 'under13', xp: 0, role: 'student' });
      await setDoc(doc(db, 'public_profiles/adult1'), { displayName: 'Ava', ageTier: 'adult', xp: 0, role: 'student' });

      await setDoc(doc(db, 'spaces/school-child'), {
        kind: 'school', ageTier: 'under13', visibility: 'members', memberIds: ['child1'], staffIds: [], title: 'Junior school',
      });
      await setDoc(doc(db, 'spaces/year-10'), {
        kind: 'year', ageTier: 'teen', visibility: 'tier', year: 'Year 10', memberIds: [], staffIds: [], title: 'Year 10',
      });
      await setDoc(doc(db, 'spaces/subject-maths'), {
        kind: 'subject', ageTier: 'teen', visibility: 'tier', subject: 'Maths', memberIds: [], staffIds: [], title: 'Maths',
      });
      await setDoc(doc(db, 'spaces/explore-adult'), {
        kind: 'adult', ageTier: 'adult', visibility: 'tier', memberIds: [], staffIds: [], title: 'Explore',
      });
      await setDoc(doc(db, 'spaces/class-1'), {
        kind: 'class', ageTier: 'under13', visibility: 'members', memberIds: ['child1'], staffIds: ['teacherA'], title: 'Year 4',
      });
      await setDoc(doc(db, 'posts/post-child'), {
        spaceId: 'class-1', authorId: 'child1', ageTier: 'under13', kind: 'win', body: 'Solved it', moderation: 'allow',
      });
      await setDoc(doc(db, 'posts/post-teen'), {
        spaceId: 'subject-maths', authorId: 'teen1', ageTier: 'teen', kind: 'win', body: 'Finished the set', moderation: 'allow',
      });
      await setDoc(doc(db, 'posts/post-adult'), {
        spaceId: 'explore-adult', authorId: 'adult1', ageTier: 'adult', kind: 'question', body: 'Anyone sitting the paper?', moderation: 'allow',
      });
      await setDoc(doc(db, 'comments/c-child'), {
        postId: 'post-child', spaceId: 'class-1', authorId: 'child1', ageTier: 'under13', body: 'Nice', moderation: 'allow',
      });
      await setDoc(doc(db, 'reactions/post-child_child1'), { postId: 'post-child', userId: 'child1', emoji: 'clap', ageTier: 'under13' });
      await setDoc(doc(db, 'reactions/post-adult_adult1'), { postId: 'post-adult', userId: 'adult1', emoji: 'clap', ageTier: 'adult' });
      await setDoc(doc(db, 'channels/class-1'), {
        kind: 'class', ageTier: 'under13', memberIds: ['child1'], staffIds: ['teacherA'], title: 'Year 4',
      });
      await setDoc(doc(db, 'channels/class-1/messages/m1'), { senderId: 'child1', body: 'Homework?', moderation: 'allow' });
      await setDoc(doc(db, 'channels/parents-1'), {
        kind: 'parent', ageTier: 'adult', memberIds: ['parent1', 'teacherA'], staffIds: ['teacherA'], title: 'Parents',
      });
      await setDoc(doc(db, 'channels/parents-1/messages/m1'), { senderId: 'teacherA', body: 'Trip Friday', moderation: 'allow' });
      await setDoc(doc(db, 'messages/cross'), { fromId: 'adult1', toId: 'child1', body: 'should not be readable', read: false });
      await setDoc(doc(db, 'moderation_queue/q1'), { status: 'open', text: 'held', authorId: 'child1', ageTier: 'under13' });
      await setDoc(doc(db, 'reports/r1'), { reporterId: 'child1', reporterAgeTier: 'under13', targetType: 'post', targetId: 'post-child', status: 'open' });
    });
  });

  function dbFor(uid: string) {
    return env.authenticatedContext(uid).firestore();
  }

  it('stops a client writing ageTier or date of birth', async () => {
    const db = dbFor('child1');
    await assertFails(updateDoc(doc(db, 'users/child1'), { ageTier: 'adult' }));
    await assertFails(updateDoc(doc(db, 'users/child1'), { ageTier: 'teen' }));
    await assertFails(updateDoc(doc(db, 'users/child1'), { dateOfBirth: '1990-01-01' }));
    const teen = dbFor('teen1');
    await assertFails(updateDoc(doc(teen, 'users/teen1'), { ageTier: 'adult' }));
    await assertSucceeds(updateDoc(doc(teen, 'users/teen1'), { yearGroup: 'Year 10' }));
    const fresh = env.authenticatedContext('child1b', { email: 'child1b@test.local' }).firestore();
    await assertFails(setDoc(doc(fresh, 'users/child1b'), {
      role: 'student', name: 'Other', email: 'child1b@test.local', xp: 0, sparksBalance: 0, emailVerified: false, ageTier: 'adult',
    }));
  });

  it('hides spaces, posts, comments, reactions and profiles across tiers', async () => {
    const child = dbFor('child1');
    const teen = dbFor('teen1');
    const otherTeen = dbFor('teen2');
    const adult = dbFor('adult1');
    const parent = dbFor('parent1');
    await assertSucceeds(getDoc(doc(child, 'spaces/school-child')));
    await assertFails(getDoc(doc(child, 'spaces/year-10')));
    await assertFails(getDoc(doc(child, 'spaces/subject-maths')));
    await assertSucceeds(getDoc(doc(teen, 'spaces/year-10')));
    await assertSucceeds(getDoc(doc(teen, 'spaces/subject-maths')));
    await assertFails(getDoc(doc(otherTeen, 'spaces/year-10')));
    await assertFails(getDoc(doc(otherTeen, 'spaces/subject-maths')));
    await assertFails(getDoc(doc(adult, 'spaces/school-child')));
    await assertFails(getDoc(doc(adult, 'spaces/subject-maths')));
    await assertFails(getDoc(doc(parent, 'spaces/class-1')));
    await assertFails(getDoc(doc(parent, 'spaces/explore-adult')));
    await assertFails(getDoc(doc(child, 'spaces/explore-adult')));
    await assertSucceeds(getDoc(doc(adult, 'spaces/explore-adult')));
    await assertSucceeds(getDoc(doc(child, 'posts/post-child')));
    await assertSucceeds(getDoc(doc(child, 'comments/c-child')));
    await assertFails(getDoc(doc(adult, 'posts/post-child')));
    await assertFails(getDoc(doc(teen, 'posts/post-child')));
    await assertFails(getDoc(doc(parent, 'posts/post-child')));
    await assertSucceeds(getDoc(doc(teen, 'posts/post-teen')));
    await assertFails(getDoc(doc(otherTeen, 'posts/post-teen')));
    await assertFails(getDoc(doc(child, 'posts/post-adult')));
    await assertSucceeds(getDoc(doc(adult, 'posts/post-adult')));
    await assertFails(getDoc(doc(adult, 'reactions/post-child_child1')));
    await assertSucceeds(getDoc(doc(dbFor('teacherA'), 'reactions/post-child_child1')));
    await assertFails(getDoc(doc(child, 'reactions/post-adult_adult1')));
    await assertFails(getDoc(doc(adult, 'community_profiles/child1')));
    await assertFails(getDoc(doc(child, 'community_profiles/adult1')));
    await assertFails(getDoc(doc(teen, 'community_profiles/child1')));
    await assertFails(getDoc(doc(adult, 'public_profiles/child1')));
    await assertFails(getDoc(doc(child, 'public_profiles/adult1')));
    await assertSucceeds(getDoc(doc(child, 'public_profiles/child1')));
    await assertSucceeds(getDoc(doc(child, 'reports/r1')));
    await assertFails(getDoc(doc(adult, 'reports/r1')));
  });

  it('lets class staff read their own class and blocks every other adult', async () => {
    await assertSucceeds(getDoc(doc(dbFor('teacherA'), 'spaces/class-1')));
    await assertSucceeds(getDoc(doc(dbFor('child1'), 'spaces/class-1')));
    await assertFails(getDoc(doc(dbFor('child2'), 'spaces/class-1')));
    await assertFails(getDoc(doc(dbFor('teacherB'), 'spaces/class-1')));
    await assertFails(getDoc(doc(dbFor('adult1'), 'spaces/class-1')));
    await assertFails(getDoc(doc(dbFor('parent1'), 'spaces/class-1')));
    await assertSucceeds(getDoc(doc(dbFor('teacherA'), 'posts/post-child')));
    await assertSucceeds(getDoc(doc(dbFor('teacherA'), 'channels/class-1')));
    await assertSucceeds(getDoc(doc(dbFor('teacherA'), 'channels/class-1/messages/m1')));
    await assertFails(getDoc(doc(dbFor('adult1'), 'channels/class-1')));
    await assertFails(getDoc(doc(dbFor('adult1'), 'channels/class-1/messages/m1')));
    await assertFails(getDoc(doc(dbFor('teacherB'), 'channels/class-1/messages/m1')));
    await assertSucceeds(getDoc(doc(dbFor('parent1'), 'channels/parents-1')));
    await assertFails(getDoc(doc(dbFor('child1'), 'channels/parents-1')));
    await assertFails(getDoc(doc(dbFor('child1'), 'channels/parents-1/messages/m1')));
  });

  it('blocks cross-tier follows and allows same-tier follows', async () => {
    const child = dbFor('child1');
    await assertFails(setDoc(doc(child, 'follows/child1_adult1'), {
      followerId: 'child1', targetId: 'adult1', followerAgeTier: 'under13', targetAgeTier: 'under13',
    }));
    await assertFails(setDoc(doc(child, 'follows/child1_teen1'), {
      followerId: 'child1', targetId: 'teen1', followerAgeTier: 'teen', targetAgeTier: 'teen',
    }));
    await assertSucceeds(setDoc(doc(child, 'follows/child1_child2'), {
      followerId: 'child1', targetId: 'child2', followerAgeTier: 'under13', targetAgeTier: 'under13',
    }));
    const adult = dbFor('adult1');
    await assertFails(setDoc(doc(adult, 'follows/adult1_child1'), {
      followerId: 'adult1', targetId: 'child1', followerAgeTier: 'adult', targetAgeTier: 'adult',
    }));
    await assertSucceeds(setDoc(doc(adult, 'follows/adult1_adult2'), {
      followerId: 'adult1', targetId: 'adult2', followerAgeTier: 'adult', targetAgeTier: 'adult',
    }));
    await assertFails(getDoc(doc(child, 'follows/adult1_adult2')));
    await assertFails(setDoc(doc(dbFor('parent1'), 'follows/parent1_adult1'), {
      followerId: 'parent1', targetId: 'adult1', followerAgeTier: 'adult', targetAgeTier: 'adult',
    }));
  });

  it('keeps direct messages adult-only', async () => {
    const child = dbFor('child1');
    const teen = dbFor('teen1');
    await assertFails(setDoc(doc(child, 'messages/c-c'), { fromId: 'child1', toId: 'child2', body: 'hi', read: false }));
    await assertFails(setDoc(doc(teen, 'messages/t-t'), { fromId: 'teen1', toId: 'teen2', body: 'hi', read: false }));
    await assertFails(setDoc(doc(child, 'messages/c-a'), { fromId: 'child1', toId: 'adult1', body: 'hi', read: false }));
    const adult = dbFor('adult1');
    await assertFails(setDoc(doc(adult, 'messages/a-c'), { fromId: 'adult1', toId: 'child1', body: 'hi', read: false }));
    await assertFails(setDoc(doc(adult, 'messages/a-teen'), { fromId: 'adult1', toId: 'teen1', body: 'hi', read: false }));
    await assertFails(getDoc(doc(adult, 'messages/cross')));
    await assertFails(getDoc(doc(child, 'messages/cross')));
    await assertFails(getDoc(doc(teen, 'messages/cross')));
    const teacher = dbFor('teacherA');
    await assertFails(setDoc(doc(teacher, 'messages/t-c'), { fromId: 'teacherA', toId: 'child1', body: 'hi', read: false }));
    await assertFails(setDoc(doc(adult, 'messages/a-shy'), { fromId: 'adult1', toId: 'adult2', body: 'hi', read: false }));
    await assertSucceeds(setDoc(doc(adult, 'messages/a-opt'), { fromId: 'adult1', toId: 'adult3', body: 'hi', read: false }));
    const parent = dbFor('parent1');
    await assertSucceeds(setDoc(doc(parent, 'messages/p-t'), { fromId: 'parent1', toId: 'teacherA', body: 'hello', read: false }));
    await assertFails(setDoc(doc(parent, 'messages/p-c'), { fromId: 'parent1', toId: 'child1', body: 'hello', read: false }));
  });

  it('keeps the moderation queue to admins and parent controls to linked parents', async () => {
    await assertFails(getDoc(doc(dbFor('child1'), 'moderation_queue/q1')));
    await assertFails(getDoc(doc(dbFor('teacherA'), 'moderation_queue/q1')));
    await assertSucceeds(getDoc(doc(dbFor('admin1'), 'moderation_queue/q1')));
    const controls = {
      studentId: 'child1', communityEnabled: true, messagingEnabled: false, snapEnabled: true,
      quietStart: '21:00', quietEnd: '07:00', timeZone: 'Asia/Kuala_Lumpur',
    };
    await assertSucceeds(setDoc(doc(dbFor('parent1'), 'parent_controls/child1'), controls));
    await assertFails(setDoc(doc(dbFor('adult1'), 'parent_controls/child1'), controls));
    await assertSucceeds(getDoc(doc(dbFor('child1'), 'parent_controls/child1')));
    await assertFails(getDoc(doc(dbFor('parent1'), 'spaces/class-1')));
  });

  it('refuses a child adult profile, a licensed paper from the client, and self-approval', async () => {
    await assertFails(setDoc(doc(dbFor('child2'), 'community_profiles/child2'), { ageTier: 'adult', displayName: 'Nope' }));
    await assertFails(setDoc(doc(dbFor('teen1'), 'community_profiles/teen1'), { ageTier: 'adult', displayName: 'Nope' }));
    const teacher = dbFor('teacherA');
    await assertFails(setDoc(doc(teacher, 'exam_papers/lic'), {
      license: 'licensed', uploadedBy: 'teacherA', status: 'draft', board: 'Cambridge',
    }));
    await assertSucceeds(setDoc(doc(teacher, 'exam_papers/own'), {
      license: 'teacher_upload', uploadedBy: 'teacherA', status: 'draft', board: 'Cambridge', title: 'Paper 1',
    }));
    await assertSucceeds(setDoc(doc(teacher, 'creator_resources/note1'), {
      authorId: 'teacherA', status: 'draft', kind: 'note', title: 'Vectors', body: 'Notes',
    }));
    await assertFails(updateDoc(doc(teacher, 'creator_resources/note1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(teacher, 'creator_resources/note1'), { status: 'pending' }));
    await assertFails(setDoc(doc(dbFor('child1'), 'spaces/hack'), {
      kind: 'adult', ageTier: 'adult', visibility: 'tier', memberIds: [], staffIds: [], title: 'Nope',
    }));
  });
});
