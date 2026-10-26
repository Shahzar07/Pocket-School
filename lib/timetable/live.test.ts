import assert from 'node:assert/strict';
import test from 'node:test';
import { blankTimetable, isInventedTimetable, mondayOf, personalTimetable, schoolTimetable } from './seed';

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

test('a saved copy of the sample week is still recognised', () => {
  const saved = schoolTimetable();
  saved.sample = undefined;
  assert.equal(isInventedTimetable(saved), true);
});
