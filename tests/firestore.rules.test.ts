import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
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
    await setDoc(doc(db, 'report_cards/card1'), {
      studentId: 'student1', teacherId: 'teacher1', courseTitle: 'Maths', grade: '8',
    });
  });
}

before(async () => {
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
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const people: [string, Record<string, unknown>][] = [
      ['child1', { role: 'student', name: 'Mina', ageTier: 'under13', yearGroup: '', subjects: [] }],
      ['child2', { role: 'student', name: 'Milo', ageTier: 'under13' }],
      ['teen1', { role: 'student', name: 'Noor', ageTier: 'teen', yearGroup: 'Year 10', subjects: ['Maths'] }],
      ['teen2', { role: 'student', name: 'Eli', ageTier: 'teen', yearGroup: 'Year 11', subjects: ['English'] }],
      ['adult1', { role: 'student', name: 'Ava', ageTier: 'adult' }],
      ['adult2', { role: 'student', name: 'Owen', ageTier: 'adult' }],
      ['adult3', { role: 'student', name: 'Noa', ageTier: 'adult' }],
      ['teacherA', { role: 'teacher', name: 'Tess', ageTier: 'adult' }],
      ['teacherB', { role: 'teacher', name: 'Theo', ageTier: 'adult' }],
      ['parent1', { role: 'parent', name: 'Pat', ageTier: 'adult', childIds: ['child1'] }],
      ['admin1', { role: 'admin', name: 'Admin', ageTier: 'adult' }],
    ];
    for (const [id, data] of people) await setDoc(doc(db, `users/${id}`), data);
    await setDoc(doc(db, 'community_profiles/adult1'), { ageTier: 'adult', displayName: 'Ava', adultDmOptIn: true });
    await setDoc(doc(db, 'community_profiles/adult3'), { ageTier: 'adult', displayName: 'Noa', adultDmOptIn: true });
    await setDoc(doc(db, 'community_profiles/adult2'), { ageTier: 'adult', displayName: 'Owen', adultDmOptIn: false });
    await setDoc(doc(db, 'community_profiles/child1'), { ageTier: 'under13', displayName: 'Mina' });
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
    await setDoc(doc(db, 'messages/cross'), { fromId: 'adult1', toId: 'child1', body: 'no', read: false });
    await setDoc(doc(db, 'moderation_queue/q1'), { status: 'open', text: 'held', authorId: 'child1', ageTier: 'under13' });
    await setDoc(doc(db, 'reports/r1'), {
      reporterId: 'child1', reporterAgeTier: 'under13', targetType: 'post', targetId: 'post-child', status: 'open',
    });
  });
});

after(async () => {
  await env.cleanup();
});

function dbFor(uid: string) {
  return env.authenticatedContext(uid).firestore();
}

describe('community age tiers', () => {
  it('stops a client writing ageTier or date of birth', async () => {
    const child = dbFor('child1');
    await assertFails(updateDoc(doc(child, 'users/child1'), { ageTier: 'adult' }));
    await assertFails(updateDoc(doc(child, 'users/child1'), { dateOfBirth: '2014-01-01' }));
    await assertFails(updateDoc(doc(dbFor('teen1'), 'users/teen1'), { ageTier: 'adult' }));
  });

  it('separates under-13, teens, and adults, and keeps parents off the wall', async () => {
    const child = dbFor('child1');
    const teen = dbFor('teen1');
    const otherTeen = dbFor('teen2');
    const adult = dbFor('adult1');
    const parent = dbFor('parent1');
    await assertSucceeds(getDoc(doc(child, 'spaces/school-child')));
    await assertFails(getDoc(doc(child, 'spaces/year-10')));
    await assertFails(getDoc(doc(child, 'spaces/explore-adult')));
    await assertSucceeds(getDoc(doc(teen, 'spaces/year-10')));
    await assertSucceeds(getDoc(doc(teen, 'spaces/subject-maths')));
    await assertFails(getDoc(doc(otherTeen, 'spaces/year-10')));
    await assertFails(getDoc(doc(otherTeen, 'spaces/subject-maths')));
    await assertSucceeds(getDoc(doc(adult, 'spaces/explore-adult')));
    await assertFails(getDoc(doc(adult, 'spaces/school-child')));
    await assertFails(getDoc(doc(adult, 'spaces/subject-maths')));
    await assertFails(getDoc(doc(parent, 'spaces/class-1')));
    await assertFails(getDoc(doc(parent, 'spaces/explore-adult')));
    await assertFails(getDoc(doc(parent, 'community_profiles/adult1')));
    await assertFails(getDoc(doc(parent, 'community_profiles/child1')));
    await assertSucceeds(getDoc(doc(child, 'posts/post-child')));
    await assertSucceeds(getDoc(doc(child, 'comments/c-child')));
    await assertFails(getDoc(doc(adult, 'posts/post-child')));
    await assertFails(getDoc(doc(teen, 'posts/post-child')));
    await assertFails(getDoc(doc(parent, 'posts/post-child')));
    await assertSucceeds(getDoc(doc(teen, 'posts/post-teen')));
    await assertFails(getDoc(doc(otherTeen, 'posts/post-teen')));
    await assertSucceeds(getDoc(doc(adult, 'posts/post-adult')));
    await assertFails(getDoc(doc(child, 'posts/post-adult')));
    await assertFails(getDoc(doc(adult, 'reactions/post-child_child1')));
    await assertSucceeds(getDoc(doc(dbFor('teacherA'), 'reactions/post-child_child1')));
    await assertFails(getDoc(doc(adult, 'community_profiles/child1')));
    await assertFails(getDoc(doc(child, 'community_profiles/adult1')));
    await assertSucceeds(getDoc(doc(child, 'reports/r1')));
    await assertFails(getDoc(doc(adult, 'reports/r1')));
  });

  it('lets class staff through and blocks every other adult', async () => {
    await assertSucceeds(getDoc(doc(dbFor('teacherA'), 'spaces/class-1')));
    await assertSucceeds(getDoc(doc(dbFor('teacherA'), 'posts/post-child')));
    await assertSucceeds(getDoc(doc(dbFor('child1'), 'spaces/class-1')));
    await assertFails(getDoc(doc(dbFor('child2'), 'spaces/class-1')));
    await assertFails(getDoc(doc(dbFor('teacherB'), 'spaces/class-1')));
    await assertFails(getDoc(doc(dbFor('adult1'), 'spaces/class-1')));
    await assertFails(getDoc(doc(dbFor('parent1'), 'spaces/class-1')));
  });

  it('follows only inside one tier, and never as a parent', async () => {
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
    await assertSucceeds(setDoc(doc(dbFor('adult1'), 'follows/adult1_adult2'), {
      followerId: 'adult1', targetId: 'adult2', followerAgeTier: 'adult', targetAgeTier: 'adult',
    }));
    await assertFails(getDoc(doc(child, 'follows/adult1_adult2')));
    await assertFails(setDoc(doc(dbFor('parent1'), 'follows/parent1_teacherA'), {
      followerId: 'parent1', targetId: 'teacherA', followerAgeTier: 'adult', targetAgeTier: 'adult',
    }));
  });

  it('keeps messages adult-only', async () => {
    await assertFails(setDoc(doc(dbFor('child1'), 'messages/c-c'), { fromId: 'child1', toId: 'child2', body: 'hi', read: false }));
    await assertFails(setDoc(doc(dbFor('teen1'), 'messages/t-t'), { fromId: 'teen1', toId: 'teen2', body: 'hi', read: false }));
    await assertFails(setDoc(doc(dbFor('adult1'), 'messages/a-c'), { fromId: 'adult1', toId: 'child1', body: 'hi', read: false }));
    await assertFails(setDoc(doc(dbFor('teacherA'), 'messages/t-c'), { fromId: 'teacherA', toId: 'child1', body: 'hi', read: false }));
    await assertFails(getDoc(doc(dbFor('adult1'), 'messages/cross')));
    await assertFails(getDoc(doc(dbFor('child1'), 'messages/cross')));
    await assertFails(setDoc(doc(dbFor('adult1'), 'messages/a-shy'), { fromId: 'adult1', toId: 'adult2', body: 'hi', read: false }));
    await assertSucceeds(setDoc(doc(dbFor('adult1'), 'messages/a-opt'), { fromId: 'adult1', toId: 'adult3', body: 'hi', read: false }));
    await assertSucceeds(setDoc(doc(dbFor('parent1'), 'messages/p-t'), { fromId: 'parent1', toId: 'teacherA', body: 'hello', read: false }));
    await assertFails(setDoc(doc(dbFor('parent1'), 'messages/p-c'), { fromId: 'parent1', toId: 'child1', body: 'hello', read: false }));
  });

  it('keeps the queue to admins and parent controls to a linked parent', async () => {
    await assertFails(getDoc(doc(dbFor('child1'), 'moderation_queue/q1')));
    await assertFails(getDoc(doc(dbFor('teacherA'), 'moderation_queue/q1')));
    await assertSucceeds(getDoc(doc(dbFor('admin1'), 'moderation_queue/q1')));
    const controls = {
      studentId: 'child1', communityEnabled: true, messagingEnabled: false, snapEnabled: true,
    };
    await assertSucceeds(setDoc(doc(dbFor('parent1'), 'parent_controls/child1'), controls));
    await assertFails(setDoc(doc(dbFor('adult1'), 'parent_controls/child1'), controls));
    await assertSucceeds(getDoc(doc(dbFor('child1'), 'parent_controls/child1')));
    await assertFails(setDoc(doc(dbFor('child1'), 'spaces/hack'), {
      kind: 'adult', ageTier: 'adult', visibility: 'tier', memberIds: [], staffIds: [], title: 'Nope',
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
    await assertFails(getDoc(doc(parent, 'community_profiles/adult1')));
    await assertFails(getDoc(doc(parent, 'community_profiles/child1')));
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

describe('goals, snapshots, integrity, and published reports', () => {
  beforeEach(async () => {
    await seed();
  });

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
    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertFails(getDoc(doc(teacher, 'daily_goals/goal1')));
    const own = env.authenticatedContext('student1').firestore();
    await assertSucceeds(updateDoc(doc(own, 'daily_goals/goal1'), {
      shareWithTeachers: true, teacherIds: ['teacher1'],
    }));
    await assertSucceeds(getDoc(doc(teacher, 'daily_goals/goal1')));
    await assertSucceeds(updateDoc(doc(own, 'daily_goals/goal1'), { shareWithTeachers: false }));
    await assertFails(getDoc(doc(teacher, 'daily_goals/goal1')));
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
    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertFails(getDoc(doc(teacher, 'analytics_snapshots/student_student1')));
  });

  it('lets a listed teacher read a snapshot and blocks an unlisted teacher', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'analytics_snapshots/student_shared'), {
        scopeId: 'student1', subjectStudentId: 'student1', teacherIds: ['teacher1'],
      });
    });
    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertSucceeds(getDoc(doc(teacher, 'analytics_snapshots/student_shared')));
    const otherTeacher = env.authenticatedContext('teacher2').firestore();
    await assertFails(getDoc(doc(otherTeacher, 'analytics_snapshots/student_shared')));
    const stranger = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(stranger, 'analytics_snapshots/student_shared')));
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

  it('lets a linked parent acknowledge a report card and blocks a grade change', async () => {
    const parent = env.authenticatedContext('parent1').firestore();
    await assertSucceeds(getDoc(doc(parent, 'report_cards/card1')));
    await assertSucceeds(updateDoc(doc(parent, 'report_cards/card1'), {
      acknowledgement: { status: 'acknowledged', parentId: 'parent1' },
    }));
    await assertFails(updateDoc(doc(parent, 'report_cards/card1'), { grade: '9' }));
    const stranger = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(stranger, 'report_cards/card1')));
  });
});
