import assert from 'node:assert/strict';
import test from 'node:test';
import { blankTimetable, isInventedTimetable, mondayOf, personalTimetable, schoolTimetable } from './seed';
import { loadBundle, saveDoc, timetableSchoolKey } from './store';

test('the sample week is the invented staff list and a fixed Monday', () => {
  const school = schoolTimetable();
  assert.equal(school.sample, true);
  assert.equal(school.anchorMonday, '2026-10-19');
  assert.deepEqual(school.staff.map(person => person.name), [
    'Ms Rahman', 'Ms Adeyemi', 'Mr Yusuf', 'Ms Okonkwo', 'Mr Patel', 'Mr Chen', 'Ms Lim',
  ]);
  assert.equal(isInventedTimetable(school), true);
  assert.equal(isInventedTimetable(personalTimetable()), true);
});

test('a live timetable starts this week with no invented staff', () => {
  const live = blankTimetable('school', 'uid-harry', 'inst-harry');
  assert.equal(live.sample, false);
  assert.equal(live.staff.length, 0);
  assert.equal(live.people.length, 0);
  assert.equal(live.anchorMonday, mondayOf());
  assert.equal(mondayOf(new Date(2026, 9, 26, 15)), '2026-10-26');
  assert.equal(mondayOf(new Date(2026, 9, 25, 12)), '2026-10-19');
  assert.equal(isInventedTimetable(live), false);
});

test('a live school week stays inside that institution', () => {
  const store = new Map<string, string>();
  const previous = globalThis.window;
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
      },
    },
  });
  try {
    const harry = blankTimetable('school', 'uid-harry', 'inst-harry');
    harry.staff = [{ id: 'harry-staff', name: 'Ms Khan', userId: 'uid-khan', subjects: ['Maths'], levels: ['IGCSE'], maxPerDay: 4, maxPerWeek: 16, worksDays: [], unavailable: [], prefer: 'morning', status: 'active', campusId: 'main' }];
    saveDoc(harry);
    const other = loadBundle({ institutionId: 'inst-other', ownerId: 'uid-other' });
    assert.equal(other.school.staff.length, 0);
    assert.equal(other.school.institutionId, 'inst-other');
    const again = loadBundle({ institutionId: 'inst-harry', ownerId: 'uid-harry' });
    assert.deepEqual(again.school.staff.map(person => person.name), ['Ms Khan']);
    assert.equal(timetableSchoolKey({ institutionId: 'inst-harry' }).includes('inst-other'), false);
    assert.equal(store.has('poket-timetable-v1:school:inst-harry'), true);
    assert.equal(store.has('poket-timetable-v1:school:inst-other'), false);
  } finally {
    if (previous) globalThis.window = previous;
    else delete (globalThis as { window?: Window }).window;
  }
});

test('a live load drops the staff invented in seed.ts', () => {
  const store = new Map<string, string>();
  const previous = globalThis.window;
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
      },
    },
  });
  try {
    store.set('poket-timetable-v1', JSON.stringify({ school: schoolTimetable(), personal: personalTimetable() }));
    const live = loadBundle({ institutionId: 'school-a', ownerId: 'uid-harry' });
    assert.equal(live.school.staff.length, 0);
    assert.equal(live.school.people.length, 0);
    assert.equal(isInventedTimetable(live.school), false);
    const sample = loadBundle({ sample: true, institutionId: 'school-a' });
    assert.equal(sample.school.staff.some(person => person.name === 'Ms Rahman'), true);
  } finally {
    if (previous) globalThis.window = previous;
    else delete (globalThis as { window?: Window }).window;
  }
});

test('a saved copy of the sample week is still recognised', () => {
  const saved = schoolTimetable();
  saved.sample = undefined;
  assert.equal(isInventedTimetable(saved), true);
});
