import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hardViolations } from './clashes';
import { personalTimetable, schoolTimetable } from './seed';
import { explainSolve, requestedCount, solveTimetable } from './solver';

describe('ET AI timetable solver', () => {
  it('places the school seed with no hard-constraint violations', () => {
    const doc = schoolTimetable();
    const result = solveTimetable(doc);
    assert.equal(result.unplaced.length, 0);
    assert.equal(result.lessons.length, requestedCount(doc));
    assert.deepEqual(hardViolations(doc, result.lessons), []);
    assert.ok(result.quality >= 0 && result.quality <= 100);
    assert.ok(explainSolve(result, requestedCount(doc)).includes(`Quality ${result.quality}`));
  });

  it('keeps part-time days, Friday afternoons, room types, and campuses', () => {
    const doc = schoolTimetable();
    const result = solveTimetable(doc);
    const patel = result.lessons.filter(lesson => lesson.teacherId === 'patel');
    assert.ok(patel.length > 0);
    assert.ok(patel.every(lesson => lesson.day !== 'mon'));
    const chen = result.lessons.filter(lesson => lesson.teacherId === 'chen');
    assert.ok(chen.every(lesson => lesson.periodId !== 'p5' && lesson.periodId !== 'p6' || lesson.day !== 'fri'));
    const lab = result.lessons.filter(lesson => lesson.subjectId === 'phys-ig' || lesson.subjectId === 'bio-ig');
    assert.ok(lab.every(lesson => lesson.roomId === 'r-lab'));
    const north = result.lessons.filter(lesson => lesson.campusId === 'north');
    assert.ok(north.length > 0);
    assert.ok(north.every(lesson => lesson.roomId === 'r-north' && lesson.teacherId === 'lim'));
  });

  it('places a private teacher week without double booking', () => {
    const doc = personalTimetable();
    const result = solveTimetable(doc);
    assert.equal(result.unplaced.length, 0);
    assert.deepEqual(hardViolations(doc, result.lessons), []);
    assert.ok(result.lessons.every(lesson => lesson.teacherId === 'me'));
  });
});
