import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

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
    await assertFails(updateDoc(doc(db, 'users/child1'), { studentNumber: 'PSM-0001' }));
    await assertFails(updateDoc(doc(db, 'users/child1'), { studentStatus: { status: 'verified', verifiedAt: 1, validUntil: 2 } }));
    await assertFails(setDoc(doc(db, 'offers/offer1'), { title: 'Drink', status: 'live' }));
    await assertFails(setDoc(doc(db, 'redemptions/red1'), { offerId: 'offer1', uid: 'child1', partnerId: 'cafe', at: 1, method: 'scan' }));
    const note = {
      text: 'Revise photosynthesis',
      colour: 'cyan',
      pinned: false,
      order: 1,
      board: 'My board',
      linkedTo: { type: 'lesson', id: 'l1' },
      createdAt: 1,
      updatedAt: 1,
    };
    await assertSucceeds(setDoc(doc(db, 'users/child1/notes/n1'), note));
    await assertFails(getDoc(doc(dbFor('adult1'), 'users/child1/notes/n1')));
    await assertFails(setDoc(doc(db, 'users/child1/notes/n2'), { ...note, share: { spaceId: 'class-1', status: 'live' } }));
    await assertFails(deleteDoc(doc(db, 'users/child1/notes/n1')));
    await assertFails(setDoc(doc(db, 'note_shares/child1_n1'), { ownerId: 'child1', spaceId: 'class-1', status: 'live', text: 'Revise' }));
    await assertFails(setDoc(doc(db, 'referrals/AB12CD34'), { inviterUid: 'child1', createdAt: 1, redeemedBy: [] }));
    await assertFails(setDoc(doc(db, 'card_shares/shareidshareidshare'), { uid: 'child1', revoked: false }));
    await assertFails(setDoc(doc(db, 'card_audit/evt1'), { type: 'view', uid: 'child1' }));
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
    const otherTeacher = env.authenticatedContext('teacherA').firestore();
    await assertFails(getDoc(doc(teacher, 'daily_goals/goal1')));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore();
      await updateDoc(doc(admin, 'users/student1'), { classId: 'class-maths', institutionId: 'school-a' });
      await setDoc(doc(admin, 'spaces/class-maths'), {
        kind: 'class', staffIds: ['teacher1'], memberIds: ['student1'], title: 'Maths',
      });
      await setDoc(doc(admin, 'daily_goals/secret'), {
        ...goal, title: 'Personal', source: 'self', private: true, parentVisibility: false,
      });
      await setDoc(doc(admin, 'users/student1/goals/own'), {
        studentId: 'student1', title: 'My reading', source: 'self', private: true, parentVisibility: false,
        status: 'in_progress', deadline: '18:00', dateKey: '2026-10-18', focusMinutes: 12,
      });
      await setDoc(doc(admin, 'users/student1/goals/from-teacher'), {
        studentId: 'student1', title: 'Paper', source: 'teacher', assignedBy: 'teacher1', status: 'not_started',
      });
    });
    await assertSucceeds(getDoc(doc(parent, 'daily_goals/secret')));
    await assertSucceeds(getDoc(doc(teacher, 'daily_goals/secret')));
    await assertFails(getDoc(doc(otherTeacher, 'daily_goals/secret')));
    await assertSucceeds(getDoc(doc(parent, 'users/student1/goals/own')));
    await assertSucceeds(getDoc(doc(teacher, 'users/student1/goals/own')));
    await assertFails(getDoc(doc(otherTeacher, 'users/student1/goals/own')));
    const school = env.authenticatedContext('instadmin1').firestore();
    await assertSucceeds(getDoc(doc(school, 'users/student1/goals/own')));
    const own = env.authenticatedContext('student1').firestore();
    await assertSucceeds(deleteDoc(doc(own, 'users/student1/goals/own')));
    await assertFails(deleteDoc(doc(own, 'users/student1/goals/from-teacher')));
    await assertFails(deleteDoc(doc(parent, 'users/student1/goals/from-teacher')));
    await assertSucceeds(deleteDoc(doc(teacher, 'users/student1/goals/from-teacher')));
    await assertSucceeds(setDoc(doc(parent, 'users/student1/goals/from-parent'), {
      studentId: 'student1', title: 'Read tonight', source: 'parent', assignedBy: 'parent1', status: 'not_started',
    }));
    await assertSucceeds(deleteDoc(doc(parent, 'users/student1/goals/from-parent')));
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

  it('scopes attendance reads to the class, the student, a linked parent, and the school', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'attendance_records/session1'), {
        teacherId: 'teacher1', courseId: 'fractions', institutionId: 'school-a', dateKey: '2026-10-09',
        studentIds: ['student1'], parentIds: ['parent1'],
        records: [{ studentId: 'student1', status: 'absent' }],
      });
      await setDoc(doc(ctx.firestore(), 'attendance_records/other-school'), {
        teacherId: 'teacher1', courseId: 'fractions', institutionId: 'school-b', dateKey: '2026-10-09',
        studentIds: ['student2'], parentIds: [],
        records: [{ studentId: 'student2', status: 'present' }],
      });
    });
    const student = env.authenticatedContext('student1').firestore();
    const other = env.authenticatedContext('student2').firestore();
    const teacher = env.authenticatedContext('teacher1').firestore();
    const strangerTeacher = env.authenticatedContext('teacher2').firestore();
    const parent = env.authenticatedContext('parent1').firestore();
    const school = env.authenticatedContext('instadmin1').firestore();
    await assertSucceeds(getDoc(doc(student, 'attendance_records/session1')));
    await assertFails(getDoc(doc(other, 'attendance_records/session1')));
    await assertSucceeds(getDoc(doc(teacher, 'attendance_records/session1')));
    await assertFails(getDoc(doc(strangerTeacher, 'attendance_records/session1')));
    await assertSucceeds(getDoc(doc(parent, 'attendance_records/session1')));
    await assertSucceeds(getDoc(doc(school, 'attendance_records/session1')));
    await assertFails(getDoc(doc(school, 'attendance_records/other-school')));
  });

  it('lets a linked parent file an absence note and a teacher accept it', async () => {
    const parent = env.authenticatedContext('parent1').firestore();
    await assertSucceeds(setDoc(doc(parent, 'absence_notes/note1'), {
      studentId: 'student1', parentId: 'parent1', dateKey: '2026-10-09', reason: 'Flu', status: 'submitted',
    }));
    await assertFails(setDoc(doc(parent, 'absence_notes/note2'), {
      studentId: 'student2', parentId: 'parent1', dateKey: '2026-10-09', reason: 'Flu', status: 'submitted',
    }));
    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(getDoc(doc(student, 'absence_notes/note1')));
    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertSucceeds(updateDoc(doc(teacher, 'absence_notes/note1'), { status: 'accepted' }));
    await assertFails(updateDoc(doc(teacher, 'absence_notes/note1'), { reason: 'Changed' }));
  });

  it('lets a linked parent read a grade', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'grades/g1'), { studentId: 'student1', score: 8, maxScore: 10 });
    });
    const parent = env.authenticatedContext('parent1').firestore();
    await assertSucceeds(getDoc(doc(parent, 'grades/g1')));
    const other = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(other, 'grades/g1')));
  });

  it('records a report export for the actor and an admin only', async () => {
    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(setDoc(doc(student, 'report_exports/exp1'), {
      actorId: 'student1', role: 'student', format: 'pdf', metricIds: ['attendance_rate'], scopeId: 'student1', at: '2026-10-15T18:00:00.000Z',
    }));
    await assertSucceeds(getDoc(doc(student, 'report_exports/exp1')));
    await assertFails(updateDoc(doc(student, 'report_exports/exp1'), { format: 'csv' }));
    const other = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(other, 'report_exports/exp1')));
    await assertFails(setDoc(doc(other, 'report_exports/exp2'), {
      actorId: 'student1', role: 'student', format: 'csv', metricIds: ['quiz_average'], scopeId: 'student1', at: '2026-10-15T18:00:00.000Z',
    }));
    const admin = env.authenticatedContext('admin1').firestore();
    await assertSucceeds(getDoc(doc(admin, 'report_exports/exp1')));
  });

  it('keeps behaviour notes and mood check-ins to the student, parent, teacher, and school', async () => {
    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertSucceeds(setDoc(doc(teacher, 'behaviour_records/note1'), {
      studentId: 'student1', studentName: 'Mina', type: 'merit', points: 5,
      description: 'Helped a classmate', recordedBy: 'teacher1', recordedByName: 'Ada', institutionId: 'school-a',
    }));
    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(getDoc(doc(student, 'behaviour_records/note1')));
    const other = env.authenticatedContext('student2').firestore();
    await assertFails(getDoc(doc(other, 'behaviour_records/note1')));
    const parent = env.authenticatedContext('parent1').firestore();
    await assertSucceeds(getDoc(doc(parent, 'behaviour_records/note1')));
    const stranger = env.authenticatedContext('teacher2').firestore();
    await assertFails(getDoc(doc(stranger, 'behaviour_records/note1')));
    const school = env.authenticatedContext('instadmin1').firestore();
    await assertSucceeds(getDoc(doc(school, 'behaviour_records/note1')));
    await assertFails(setDoc(doc(other, 'behaviour_records/forged'), {
      studentId: 'student2', type: 'merit', points: 5, description: 'Nope', recordedBy: 'teacher1',
    }));

    await assertSucceeds(setDoc(doc(student, 'mood_checkins/student1_2026-10-15'), {
      studentId: 'student1', dateKey: '2026-10-15', mood: 4, effort: 3,
    }));
    await assertSucceeds(getDoc(doc(parent, 'mood_checkins/student1_2026-10-15')));
    await assertFails(getDoc(doc(stranger, 'mood_checkins/student1_2026-10-15')));
    await assertFails(getDoc(doc(other, 'mood_checkins/student1_2026-10-15')));
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

  it('keeps concern flags, re-exams, and school templates inside the role', async () => {
    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertSucceeds(setDoc(doc(teacher, 'concern_flags/flag1'), {
      studentId: 'student1', teacherId: 'teacher1', institutionId: 'school-a', kind: 'wellbeing',
      severity: 'urgent', title: 'Wellbeing check-in', detail: 'Low check-in', automaticPenalty: false,
      notify: ['parent', 'teacher'],
    }));
    await assertFails(setDoc(doc(teacher, 'concern_flags/penalty'), {
      studentId: 'student1', teacherId: 'teacher1', kind: 'at_risk', automaticPenalty: true,
    }));
    const student = env.authenticatedContext('student1').firestore();
    const other = env.authenticatedContext('student2').firestore();
    const parent = env.authenticatedContext('parent1').firestore();
    const school = env.authenticatedContext('instadmin1').firestore();
    await assertSucceeds(getDoc(doc(student, 'concern_flags/flag1')));
    await assertSucceeds(getDoc(doc(parent, 'concern_flags/flag1')));
    await assertFails(getDoc(doc(other, 'concern_flags/flag1')));
    await assertFails(getDoc(doc(school, 'concern_flags/flag1')));

    await assertSucceeds(setDoc(doc(student, 'reexam_responses/resp1'), {
      caseId: 'case1', studentId: 'student1', teacherId: 'teacher1', answers: 'One quarter.', automaticPenalty: false,
    }));
    await assertFails(setDoc(doc(other, 'reexam_responses/resp2'), {
      caseId: 'case1', studentId: 'student1', teacherId: 'teacher1', answers: 'Copied.', automaticPenalty: false,
    }));
    await assertSucceeds(getDoc(doc(teacher, 'reexam_responses/resp1')));
    await assertFails(updateDoc(doc(student, 'reexam_responses/resp1'), { answers: 'Changed' }));

    await assertSucceeds(setDoc(doc(student, 'notify_settings/student1'), { quietStart: '21:00', quietEnd: '07:00' }));
    await assertFails(setDoc(doc(student, 'notify_settings/student2'), { quietStart: '21:00', quietEnd: '07:00' }));
    await assertSucceeds(setDoc(doc(school, 'notify_settings/school_school-a'), {
      quietStart: '21:00', quietEnd: '07:00', institutionId: 'school-a',
    }));

    await assertSucceeds(setDoc(doc(school, 'report_templates/tpl-a'), {
      institutionId: 'school-a', label: 'Term', heading: 'Term report', scaleId: 'a_to_e', logoUrl: 'https://poketschool.ai/logo.png',
    }));
    await assertFails(setDoc(doc(school, 'report_templates/tpl-b'), {
      institutionId: 'school-b', label: 'Other', heading: 'Other', scaleId: 'a_to_e', logoUrl: '',
    }));
    await assertFails(getDoc(doc(other, 'report_templates/tpl-a')));
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
    await assertFails(deleteDoc(doc(student, 'certificates/cert-1')));

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

describe('institution console', () => {
  it('lets anyone request a demo and keeps the pipeline with platform admins', async () => {
    const anon = env.unauthenticatedContext().firestore();
    const lead = {
      name: 'Ada',
      email: 'ada@school.example',
      organisation: 'North Academy',
      country: 'MY',
      type: 'school',
      seats: 40,
      message: 'A walkthrough for the campus team.',
      createdAt: new Date(),
    };
    await assertSucceeds(addDoc(collection(anon, 'demo_leads'), { ...lead, status: 'new' }));
    await assertFails(addDoc(collection(anon, 'demo_leads'), { ...lead, status: 'won' }));
    await assertFails(getDocs(collection(anon, 'demo_leads')));
  });

  it('stops an institution admin writing another academy audit log or a raw secret', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/instA'), { role: 'institution_admin', institutionId: 'school-a', name: 'A' });
      await setDoc(doc(db, 'institutions/school-a'), { name: 'A', status: 'active', plan: 'team' });
      await setDoc(doc(db, 'institutions/school-b'), { name: 'B', status: 'active', plan: 'oem' });
    });
    const academy = env.authenticatedContext('instA').firestore();
    await assertFails(addDoc(collection(academy, 'institutions/school-b/audit'), {
      actorId: 'instA', action: 'save-profile', target: 'school-b', at: '2026-10-16',
    }));
    await assertSucceeds(addDoc(collection(academy, 'institutions/school-a/audit'), {
      actorId: 'instA', action: 'save-profile', target: 'school-a', at: '2026-10-16',
    }));
    await assertFails(updateDoc(doc(academy, 'institutions/school-a'), { plan: 'oem' }));
    await assertFails(addDoc(collection(academy, 'institutions/school-a/api_keys'), {
      name: 'leaked', prefix: 'pk_abcd', hash: 'abc', secret: 'nope',
    }));
  });

  it('lets a platform admin edit institution volume prices and keeps an academy from writing them', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { role: 'admin', name: 'Admin' });
      await setDoc(doc(db, 'users/instA'), { role: 'institution_admin', institutionId: 'school-a', name: 'A' });
      await setDoc(doc(db, 'institutions/school-a'), { name: 'A', status: 'active', plan: 'team' });
    });
    const admin = env.authenticatedContext('admin1').firestore();
    await assertSucceeds(setDoc(doc(admin, 'institution_pricing/current'), { currency: 'USD', tiers: [] }));
    await assertSucceeds(setDoc(doc(admin, 'institutions/school-a/pricing/current'), { discountPercent: 10 }));
    const academy = env.authenticatedContext('instA').firestore();
    await assertSucceeds(getDoc(doc(academy, 'institution_pricing/current')));
    await assertFails(setDoc(doc(academy, 'institution_pricing/current'), { currency: 'USD' }));
    await assertFails(setDoc(doc(academy, 'institutions/school-a/pricing/current'), { discountPercent: 50 }));
  });

  it('publishes a subdomain redirect the public site can follow', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/instA'), { role: 'institution_admin', institutionId: 'school-a', name: 'A' });
      await setDoc(doc(db, 'institutions/school-a'), { name: 'A', status: 'active', plan: 'enterprise', subdomain: 'north' });
    });
    const academy = env.authenticatedContext('instA').firestore();
    await assertSucceeds(setDoc(doc(academy, 'subdomain_redirects/old-north'), { institutionId: 'school-a', subdomain: 'north' }));
    await assertFails(setDoc(doc(academy, 'subdomain_redirects/stolen'), { institutionId: 'school-b', subdomain: 'north' }));
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'subdomain_redirects/old-north')));
  });
});

describe('activity log and credential records', () => {
  it('keeps the activity log server-written and hides the signing key', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/student1'), {
        role: 'student', name: 'Harry Student', email: 'student@example.com', xp: 0, sparksBalance: 0,
      });
      await setDoc(doc(db, 'users/teacher1'), {
        role: 'teacher', name: 'Ada Teacher', email: 'teacher@example.com', xp: 0, sparksBalance: 0,
      });
      await setDoc(doc(db, 'users/admin1'), {
        role: 'admin', name: 'Admin', email: 'admin@example.com', xp: 0, sparksBalance: 0,
      });
      await setDoc(doc(db, 'users/instadmin1'), {
        role: 'institution_admin', name: 'Inst Admin', email: 'inst@example.com', institutionId: 'school-a', xp: 0, sparksBalance: 0,
      });
      await setDoc(doc(db, 'activity_log/own-auth'), {
        actorId: 'student1', category: 'auth', action: 'auth.login', at: 1,
      });
      await setDoc(doc(db, 'activity_log/own-content'), {
        actorId: 'student1', category: 'content', action: 'content.edit', at: 2,
      });
      await setDoc(doc(db, 'activity_log/other-auth'), {
        actorId: 'student2', category: 'auth', action: 'auth.login', at: 3,
      });
      await setDoc(doc(db, 'users/student1/auth_activity/row'), {
        actorId: 'student1', category: 'auth', action: 'auth.login', at: 1,
      });
      await setDoc(doc(db, 'audit_settings/retention'), { days: 730 });
      await setDoc(doc(db, 'credential_keys/poket-school'), { publicKeyMultibase: 'zsecret' });
      await setDoc(doc(db, 'certificate_templates/default'), { headline: 'Award' });
    });

    const student = env.authenticatedContext('student1').firestore();
    await assertSucceeds(getDoc(doc(student, 'activity_log/own-auth')));
    await assertSucceeds(getDoc(doc(student, 'users/student1/auth_activity/row')));
    await assertFails(getDoc(doc(student, 'activity_log/own-content')));
    await assertFails(getDoc(doc(student, 'activity_log/other-auth')));
    await assertFails(setDoc(doc(student, 'activity_log/forged'), { actorId: 'student1', category: 'auth' }));
    await assertFails(updateDoc(doc(student, 'activity_log/own-auth'), { action: 'changed' }));
    await assertFails(deleteDoc(doc(student, 'activity_log/own-auth')));

    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'activity_log/own-auth')));

    const teacher = env.authenticatedContext('teacher1').firestore();
    await assertFails(getDoc(doc(teacher, 'users/student1/auth_activity/row')));
    await assertFails(getDoc(doc(teacher, 'activity_log/own-auth')));

    const superAdmin = env.authenticatedContext('super1', { adminRole: 'super_admin' }).firestore();
    await assertSucceeds(getDoc(doc(superAdmin, 'activity_log/own-content')));
    await assertFails(setDoc(doc(superAdmin, 'activity_log/from-super'), { actorId: 'super1', category: 'admin' }));
    await assertSucceeds(getDoc(doc(superAdmin, 'audit_settings/retention')));
    await assertFails(getDoc(doc(student, 'audit_settings/retention')));
    await assertFails(setDoc(doc(superAdmin, 'audit_settings/retention'), { days: 90 }));
    await assertFails(getDoc(doc(superAdmin, 'credential_keys/poket-school')));
    await assertFails(setDoc(doc(superAdmin, 'credential_keys/poket-school'), { publicKeyMultibase: 'z' }));

    const admin = env.authenticatedContext('admin1').firestore();
    const school = env.authenticatedContext('instadmin1').firestore();
    await assertSucceeds(getDoc(doc(admin, 'certificate_templates/default')));
    await assertSucceeds(getDoc(doc(school, 'certificate_templates/default')));
    await assertFails(getDoc(doc(student, 'certificate_templates/default')));
    await assertFails(setDoc(doc(admin, 'certificate_templates/default'), { headline: 'Nope' }));
  });
});

describe('admin catalogue and settings writes', () => {
  const nonAdmins = ['parent1', 'adult1', 'teacherA'] as const;

  async function asAdminSeed(path: string, data: Record<string, unknown>) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), path), data);
    });
  }

  it('rejects parent, student, and teacher writes to seed courses', async () => {
    const seed = {
      title: 'SPM Add Maths',
      seedKey: 'spm-add-maths-foundations',
      ownerId: 'admin1',
      ownerName: 'Poket School',
      status: 'published',
      isPublic: true,
      kind: 'marketplace',
    };
    for (const uid of nonAdmins) {
      await assertFails(setDoc(doc(dbFor(uid), 'courses/seed-new'), { ...seed, ownerId: uid }));
    }
    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'courses/seed-admin'), seed));

    await asAdminSeed('courses/seed-live', seed);
    for (const uid of nonAdmins) {
      await assertFails(updateDoc(doc(dbFor(uid), 'courses/seed-live'), { title: 'Hijack' }));
      await assertFails(updateDoc(doc(dbFor(uid), 'courses/seed-live'), { viewCount: 1 }));
      await assertFails(deleteDoc(doc(dbFor(uid), 'courses/seed-live')));
      await assertFails(setDoc(doc(dbFor(uid), 'courses/seed-live/modules/m1'), { title: 'Unit', order: 1 }));
    }

    await asAdminSeed('courses/owned-seed', { ...seed, ownerId: 'teacherA' });
    await assertFails(updateDoc(doc(dbFor('teacherA'), 'courses/owned-seed'), { title: 'Mine now' }));
    await assertFails(setDoc(doc(dbFor('teacherA'), 'courses/owned-seed/modules/m1'), { title: 'Unit', order: 1 }));
    await assertFails(setDoc(doc(dbFor('teacherA'), 'courses/owned-seed/modules/m1/lessons/l1'), {
      title: 'Lesson', order: 1, status: 'published',
    }));
    await assertSucceeds(updateDoc(doc(dbFor('admin1'), 'courses/seed-live'), { title: 'Still the catalogue' }));
  });

  it('still lets a teacher save their own draft and blocks a public listing', async () => {
    await assertSucceeds(setDoc(doc(dbFor('teacherA'), 'courses/mine'), {
      title: 'My draft', ownerId: 'teacherA', status: 'draft', isPublic: false,
    }));
    await assertSucceeds(updateDoc(doc(dbFor('teacherA'), 'courses/mine'), { title: 'My draft renamed' }));
    await assertFails(setDoc(doc(dbFor('teacherA'), 'courses/listed'), {
      title: 'Public', ownerId: 'teacherA', status: 'published', isPublic: true,
    }));
    await assertFails(setDoc(doc(dbFor('parent1'), 'courses/parent-course'), {
      title: 'No', ownerId: 'parent1', status: 'draft', isPublic: false,
    }));
    await assertFails(setDoc(doc(dbFor('adult1'), 'courses/student-course'), {
      title: 'No', ownerId: 'adult1', status: 'draft', isPublic: false,
    }));
  });

  it('rejects non-admin writes to platform settings, seed, and other admin collections', async () => {
    const writes: Array<[string, Record<string, unknown>]> = [
      ['platform_settings/main', { siteName: 'Hijack' }],
      ['platform_settings/feature_flags', { community: false }],
      ['platform_settings/payments', { mode: 'live' }],
      ['seed/catalogue', { ready: true }],
      ['programmes/igcse', { name: 'IGCSE' }],
      ['pricing_config/main', { currency: 'USD' }],
      ['institution_pricing/tiers', { seats: 10 }],
      ['admin_invites/editor@poketschool.ai', { staffRole: 'content_editor' }],
      ['platform_signals/health', { ok: false }],
      ['badges/first', { userId: 'parent1', name: 'First' }],
      ['moderation_queue/forged', { status: 'open' }],
      ['audit_settings/retention', { days: 1 }],
    ];
    for (const uid of nonAdmins) {
      for (const [path, data] of writes) {
        await assertFails(setDoc(doc(dbFor(uid), path), data));
      }
    }

    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'platform_settings/main'), { siteName: 'Poket' }));
    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'platform_settings/feature_flags'), { community: true }));
    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'seed/catalogue'), { ready: true }));
    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'programmes/igcse'), { name: 'IGCSE' }));
    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'pricing_config/main'), { currency: 'USD' }));
    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'institution_pricing/tiers'), { seats: 10 }));
    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'admin_invites/editor@poketschool.ai'), { staffRole: 'content_editor' }));
    await assertSucceeds(setDoc(doc(dbFor('admin1'), 'badges/first'), { userId: 'adult1', name: 'First' }));
    await assertFails(setDoc(doc(dbFor('admin1'), 'platform_signals/health'), { ok: true }));
    await assertFails(setDoc(doc(dbFor('admin1'), 'moderation_queue/forged'), { status: 'open' }));
    await assertFails(setDoc(doc(dbFor('admin1'), 'audit_settings/retention'), { days: 1 }));

    await assertSucceeds(getDoc(doc(dbFor('adult1'), 'platform_settings/feature_flags')));
    await assertFails(getDoc(doc(dbFor('parent1'), 'platform_settings/payments')));
    await assertFails(getDoc(doc(dbFor('teacherA'), 'platform_settings/main')));
    await assertSucceeds(getDoc(doc(dbFor('admin1'), 'platform_settings/payments')));
  });
});

describe('institution membership', () => {
  it('accepts a join request only for a listed active academy and lets that admin approve it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/learner1'), { role: 'student', name: 'Amina', institutionId: '' });
      await setDoc(doc(db, 'users/instadmin1'), { role: 'institution_admin', name: 'North Admin', institutionId: 'school-a' });
      await setDoc(doc(db, 'users/admin1'), { role: 'admin', name: 'Admin' });
      await setDoc(doc(db, 'institutions/school-a'), { name: 'North', status: 'active', listedForSelfJoin: true, plan: 'team', state: 'Selangor' });
      await setDoc(doc(db, 'institutions/school-b'), { name: 'South', status: 'active', listedForSelfJoin: false, plan: 'team' });
    });
    const learner = env.authenticatedContext('learner1').firestore();
    const request = {
      userId: 'learner1', role: 'student', email: 'amina@school.edu', name: 'Amina',
      status: 'pending', childEmails: [], createdAt: '2026-10-16T00:00:00.000Z',
    };
    await assertSucceeds(setDoc(doc(learner, 'institutions/school-a/join_requests/learner1'), request));
    await assertFails(setDoc(doc(learner, 'institutions/school-b/join_requests/learner1'), request));
    await assertFails(updateDoc(doc(learner, 'institutions/school-a/join_requests/learner1'), { status: 'approved' }));

    const academy = env.authenticatedContext('instadmin1').firestore();
    await assertFails(updateDoc(doc(academy, 'institutions/school-a'), { listedForSelfJoin: false }));
    await assertSucceeds(updateDoc(doc(academy, 'institutions/school-a/join_requests/learner1'), {
      status: 'approved', level: 'igcse_alevel', classIds: ['class-1'], courseIds: ['biology'],
      decidedBy: 'instadmin1', decidedAt: '2026-10-16T01:00:00.000Z',
    }));
    await assertSucceeds(updateDoc(doc(academy, 'users/learner1'), { institutionId: 'school-a', level: 'igcse_alevel' }));
    await assertFails(updateDoc(doc(academy, 'users/learner1'), { role: 'admin' }));

    const stranger = env.authenticatedContext('adult1').firestore();
    await assertFails(getDoc(doc(stranger, 'institutions/school-a/join_requests/learner1')));
  });

  it('keeps Sparks, billing, and partner revenue with the platform admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { role: 'admin', name: 'Admin' });
      await setDoc(doc(db, 'users/instadmin1'), { role: 'institution_admin', institutionId: 'school-a', name: 'North Admin' });
      await setDoc(doc(db, 'users/learner1'), { role: 'student', institutionId: 'school-a', name: 'Amina' });
      await setDoc(doc(db, 'institutions/school-a'), { name: 'North', status: 'active', plan: 'team' });
    });
    const admin = env.authenticatedContext('admin1').firestore();
    const academy = env.authenticatedContext('instadmin1').firestore();
    const learner = env.authenticatedContext('learner1').firestore();
    await assertSucceeds(setDoc(doc(admin, 'sparks_config/current'), { primary_secondary: 300, igcse_alevel: 800, professional: 1000 }));
    await assertFails(setDoc(doc(academy, 'sparks_config/current'), { professional: 99999 }));
    await assertSucceeds(setDoc(doc(admin, 'institutions/school-a/sparks_pool/current'), { allowance: 1600, perSeat: 800 }));
    await assertFails(setDoc(doc(academy, 'institutions/school-a/sparks_pool/current'), { allowance: 999999 }));
    await assertSucceeds(setDoc(doc(academy, 'institutions/school-a/sparks_allocations/learner1'), {
      subjectId: 'learner1', amount: 400, classId: 'class-1', note: 'October', at: '2026-10-16',
    }));
    await assertFails(setDoc(doc(academy, 'institutions/school-a/sparks_allocations/huge'), {
      subjectId: 'learner1', amount: 100000, classId: '', note: '', at: '2026-10-16',
    }));
    await assertSucceeds(getDoc(doc(learner, 'institutions/school-a/sparks_allocations/learner1')));
    await assertSucceeds(setDoc(doc(admin, 'institutions/school-a/billing/current'), { phase: 'active', total: 580.99 }));
    await assertFails(setDoc(doc(academy, 'institutions/school-a/billing/current'), { phase: 'active' }));
    await assertSucceeds(getDoc(doc(academy, 'institutions/school-a/billing/current')));
    await assertSucceeds(setDoc(doc(admin, 'partner_orgs/acme'), { name: 'Acme', recognisedBy: 'Recognised by Acme' }));
    await assertFails(setDoc(doc(academy, 'partner_orgs/acme'), { name: 'Stolen' }));
    await assertSucceeds(setDoc(doc(admin, 'partner_revenue/row1'), {
      partnerId: 'acme', amount: 1000, currency: 'USD', channel: 'enterprise_invoice',
    }));
    await assertFails(updateDoc(doc(admin, 'partner_revenue/row1'), { amount: 1 }));
    await assertSucceeds(setDoc(doc(admin, 'subscriber_billing/learner1'), { phase: 'active', subject: 'individual' }));
    await assertFails(setDoc(doc(learner, 'subscriber_billing/learner1'), { phase: 'suspended' }));
    await assertSucceeds(getDoc(doc(learner, 'subscriber_billing/learner1')));
  });

  it('stops an institution student raising their own seat invoice and hides another teacher report card', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/learner1'), { role: 'student', institutionId: 'school-a', name: 'Amina' });
      await setDoc(doc(db, 'users/adult1'), { role: 'student', institutionId: '', name: 'Ava' });
      await setDoc(doc(db, 'users/teacher1'), { role: 'teacher', institutionId: 'school-a', cohortIds: ['class-1'] });
      await setDoc(doc(db, 'users/teacher2'), { role: 'teacher', institutionId: 'school-a', cohortIds: ['class-2'] });
      await setDoc(doc(db, 'users/parent1'), { role: 'parent', childIds: ['learner1'] });
      await setDoc(doc(db, 'users/instadmin1'), { role: 'institution_admin', institutionId: 'school-a' });
      await setDoc(doc(db, 'report_cards/card-north'), {
        studentId: 'learner1', teacherId: 'teacher1', institutionId: 'school-a', classId: 'class-1', grade: 'A',
      });
    });
    const member = env.authenticatedContext('learner1').firestore();
    const independent = env.authenticatedContext('adult1').firestore();
    await assertFails(setDoc(doc(member, 'invoices/own'), { studentId: 'learner1', status: 'draft', total: 19 }));
    await assertSucceeds(setDoc(doc(independent, 'invoices/own'), { studentId: 'adult1', status: 'draft', total: 19 }));

    const teacher = env.authenticatedContext('teacher1').firestore();
    const otherTeacher = env.authenticatedContext('teacher2').firestore();
    const parent = env.authenticatedContext('parent1').firestore();
    const school = env.authenticatedContext('instadmin1').firestore();
    await assertSucceeds(getDoc(doc(teacher, 'report_cards/card-north')));
    await assertFails(getDoc(doc(otherTeacher, 'report_cards/card-north')));
    await assertSucceeds(getDoc(doc(parent, 'report_cards/card-north')));
    await assertSucceeds(getDoc(doc(school, 'report_cards/card-north')));

    const owner = env.authenticatedContext('teacher1').firestore();
    await assertFails(setDoc(doc(owner, 'courses/private-course'), {
      ownerId: 'teacher1', institutionId: 'school-a', status: 'draft', isPublic: true, title: 'Biology',
    }));
    await assertSucceeds(setDoc(doc(owner, 'courses/private-course'), {
      ownerId: 'teacher1', institutionId: 'school-a', status: 'draft', isPublic: false,
      publishScope: 'institution', marketplaceApproved: false, title: 'Biology',
    }));
    await assertFails(updateDoc(doc(owner, 'courses/private-course'), { marketplaceApproved: true }));
    await assertFails(updateDoc(doc(owner, 'courses/private-course'), { libraryApproved: true }));
    await assertFails(setDoc(doc(owner, 'courses/priced'), {
      ownerId: 'teacher1', institutionId: 'school-a', status: 'draft', isPublic: false,
      publishScope: 'institution', marketplaceApproved: false, libraryApproved: false,
      accessMode: 'both', title: 'Chemistry',
    }));
    await assertSucceeds(updateDoc(doc(school, 'courses/private-course'), {
      libraryApproved: true, libraryNote: 'In the library', libraryDecidedBy: 'instadmin1', libraryDecidedAt: '2026-10-16',
    }));
    await assertFails(updateDoc(doc(school, 'courses/private-course'), { marketplaceApproved: true }));
    await assertFails(setDoc(doc(member, 'courses/priced/purchases/learner1'), {
      userId: 'learner1', amount: 40, tender: 'sparks',
    }));
    await assertSucceeds(setDoc(doc(independent, 'courses/priced/purchases/adult1'), {
      userId: 'adult1', amount: 40, tender: 'card',
    }));
  });

  it('keeps the wallet, consents, and Sparks cap with the right role', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/admin1'), { role: 'admin', name: 'Admin' });
      await setDoc(doc(db, 'users/adult1'), { role: 'student', institutionId: '', name: 'Ava' });
      await setDoc(doc(db, 'users/instadmin1'), { role: 'institution_admin', institutionId: 'school-a' });
      await setDoc(doc(db, 'institutions/school-a'), { name: 'North', status: 'active', plan: 'team' });
    });
    const admin = env.authenticatedContext('admin1').firestore();
    const person = env.authenticatedContext('adult1').firestore();
    const school = env.authenticatedContext('instadmin1').firestore();
    await assertSucceeds(setDoc(doc(admin, 'wallets/adult1'), { currency: 'USD', balance: 25 }));
    await assertFails(setDoc(doc(person, 'wallets/adult1'), { currency: 'USD', balance: 999 }));
    await assertSucceeds(getDoc(doc(person, 'wallets/adult1')));
    await assertSucceeds(setDoc(doc(admin, 'wallet_entries/e1'), {
      userId: 'adult1', kind: 'purchase', amount: 10, tender: 'wallet',
    }));
    await assertFails(setDoc(doc(admin, 'wallet_entries/e2'), {
      userId: 'adult1', kind: 'purchase', amount: 10, tender: 'sparks',
    }));
    await assertSucceeds(setDoc(doc(person, 'consents/pdpa'), {
      userId: 'adult1', kind: 'pdpa', accepted: true, version: '2024-pdpa', at: '2026-10-16',
    }));
    await assertFails(updateDoc(doc(person, 'consents/pdpa'), { accepted: false }));
    await assertSucceeds(setDoc(doc(person, 'data_requests/export-1'), {
      userId: 'adult1', kind: 'export', status: 'pending',
    }));
    await assertFails(updateDoc(doc(person, 'data_requests/export-1'), { status: 'done' }));
    await assertSucceeds(updateDoc(doc(admin, 'data_requests/export-1'), { status: 'done' }));
    await assertSucceeds(setDoc(doc(school, 'institutions/school-a/sparks_guard/current'), { cap: 800, lowAtPercent: 20 }));
    await assertFails(setDoc(doc(person, 'institutions/school-a/sparks_guard/current'), { cap: 1 }));
  });

  it('saves a school wall post, a comment, a reaction, and a report', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/wall-student'), {
        role: 'student', ageTier: 'teen', institutionId: 'rochford', name: 'Amina',
      });
      await setDoc(doc(ctx.firestore(), 'users/wall-other'), {
        role: 'student', ageTier: 'teen', institutionId: 'rochford', name: 'Wei',
      });
    });
    const author = env.authenticatedContext('wall-student').firestore();
    const peer = env.authenticatedContext('wall-other').firestore();
    const post = {
      authorId: 'wall-student',
      authorHandle: 'amina',
      body: 'Pond notes',
      audience: 'school',
      schoolId: 'rochford',
      feed: 'school',
      locationOn: false,
      moderation: 'allow',
      reactions: { like: 0, love: 0, celebrate: 0, insightful: 0, support: 0 },
      shares: 0,
      createdAt: 1,
    };
    await assertSucceeds(setDoc(doc(author, 'wall_posts/pond'), post));
    await assertSucceeds(getDoc(doc(peer, 'wall_posts/pond')));
    await assertSucceeds(setDoc(doc(peer, 'wall_posts/pond/comments/c1'), {
      authorId: 'wall-other', body: 'Nice notes',
    }));
    await assertSucceeds(setDoc(doc(peer, 'wall_posts/pond/reactions/wall-other'), { kind: 'like' }));
    await assertSucceeds(updateDoc(doc(peer, 'wall_posts/pond'), { reactions: { like: 1 }, updatedAt: 2 }));
    await assertSucceeds(setDoc(doc(peer, 'wall_reports/r1'), {
      reporterId: 'wall-other', postId: 'pond', reason: 'Check this',
    }));
    await assertFails(setDoc(doc(peer, 'wall_posts/nope'), { ...post, authorId: 'wall-other', audience: 'public' }));
    const again = await getDoc(doc(author, 'wall_posts/pond'));
    assert.equal(again.data()?.body, 'Pond notes');
  });
});

describe('exam packs', () => {
  it('lets an admin write and a signed-in student read only published packs', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/inst1'), { role: 'institution_admin', name: 'Inst' });
    });
    const admin = env.authenticatedContext('admin1').firestore();
    const student = env.authenticatedContext('adult1').firestore();
    const school = env.authenticatedContext('inst1').firestore();
    const guest = env.unauthenticatedContext().firestore();
    const published = { id: 'harbour', name: 'Harbour statistics', status: 'published', freeFirstTopic: true };
    const draft = { id: 'draft-pack', name: 'Draft statistics', status: 'draft', freeFirstTopic: false };
    await assertSucceeds(setDoc(doc(admin, 'exam_packs/harbour'), published));
    await assertSucceeds(setDoc(doc(admin, 'exam_packs/draft-pack'), draft));
    await assertFails(setDoc(doc(student, 'exam_packs/student-pack'), { ...published, id: 'student-pack' }));
    await assertFails(setDoc(doc(school, 'exam_packs/school-pack'), { ...published, id: 'school-pack' }));
    await assertSucceeds(getDoc(doc(student, 'exam_packs/harbour')));
    await assertSucceeds(getDoc(doc(school, 'exam_packs/harbour')));
    await assertFails(getDoc(doc(student, 'exam_packs/draft-pack')));
    await assertFails(getDoc(doc(guest, 'exam_packs/harbour')));
    const listed = await assertSucceeds(getDocs(query(collection(student, 'exam_packs'), where('status', '==', 'published'))));
    assert.equal(listed.docs.some(row => row.id === 'harbour'), true);
    assert.equal(listed.docs.some(row => row.id === 'draft-pack'), false);
    await assertSucceeds(deleteDoc(doc(admin, 'exam_packs/harbour')));
    await assertFails(deleteDoc(doc(student, 'exam_packs/draft-pack')));
  });
});

describe('admin action centre', () => {
  const task = {
    id: 'hotline-1',
    type: 'safeline_case',
    entityType: 'hotline_tickets',
    entityPath: 'hotline_tickets/1',
    refPath: 'hotline_tickets/1',
    title: 'SafeLine case',
    summary: 'A ticket is waiting.',
    priority: 'critical',
    slaTier: 'critical',
    scope: { institutionId: 'school-a' },
    status: 'open',
    claimedBy: '',
    claimedAt: null,
    createdAt: 1,
    dueAt: 2,
    snoozedUntil: null,
    resolvedAt: null,
    resolvedBy: '',
    resolutionReason: '',
    resolution: null,
  };

  it('blocks client creates and a dismiss without a reason', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admin_tasks/hotline-1'), task);
    });
    const admin = env.authenticatedContext('admin1', { adminRole: 'super_admin' }).firestore();
    const student = env.authenticatedContext('adult1').firestore();
    await assertFails(getDoc(doc(student, 'admin_tasks/hotline-1')));
    await assertSucceeds(getDoc(doc(admin, 'admin_tasks/hotline-1')));
    await assertFails(setDoc(doc(admin, 'admin_tasks/new-task'), { ...task, id: 'new-task' }));
    await assertFails(deleteDoc(doc(admin, 'admin_tasks/hotline-1')));
    await assertFails(updateDoc(doc(admin, 'admin_tasks/hotline-1'), {
      status: 'dismissed',
      resolution: { action: 'dismiss', reason: 'no', by: 'admin1', at: 9 },
      resolvedAt: 9,
      resolvedBy: 'admin1',
      resolutionReason: 'no',
    }));
    await assertSucceeds(updateDoc(doc(admin, 'admin_tasks/hotline-1'), {
      status: 'dismissed',
      resolution: { action: 'reject', reason: 'Duplicate ticket', by: 'admin1', at: 9 },
      resolvedAt: 9,
      resolvedBy: 'admin1',
      resolutionReason: 'Duplicate ticket',
    }));
  });

  it('keeps emergency on in admin push preferences', async () => {
    const admin = env.authenticatedContext('admin1', { adminRole: 'super_admin' }).firestore();
    const student = env.authenticatedContext('adult1').firestore();
    const prefs = {
      mode: 'digest',
      digestTimes: ['08:00', '17:00'],
      quietHours: { start: '22:00', end: '07:00', tz: 'Asia/Kuala_Lumpur' },
      categories: { admin: true, emergency: true },
    };
    await assertSucceeds(setDoc(doc(admin, 'users/admin1/notificationPrefs/admin'), prefs));
    await assertFails(setDoc(doc(admin, 'users/admin1/notificationPrefs/admin'), {
      ...prefs,
      categories: { admin: false, emergency: false },
    }));
    await assertFails(setDoc(doc(student, 'users/admin1/notificationPrefs/admin'), prefs));
  });
});
