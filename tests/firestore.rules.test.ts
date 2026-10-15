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

afterAll(async () => {
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
