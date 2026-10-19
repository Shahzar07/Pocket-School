import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hardViolations } from './clashes';
import { parseTimetableChat, previewTimetableChat } from './chat';
import { schoolTimetable } from './seed';
import type { Lesson } from './types';

describe('studio timetable chat', () => {
  it('builds an IGCSE week and waits for confirm', () => {
    const doc = schoolTimetable();
    const intent = parseTimetableChat("build next term's timetable for IGCSE");
    assert.equal(intent?.type, 'build');
    const preview = previewTimetableChat(doc, "build next term's timetable for IGCSE");
    assert.ok(preview);
    assert.equal(preview.confirmable, true);
    assert.equal(doc.lessons.length, 0);
    assert.ok(preview.changes.some(change => change.kind === 'added' && change.label.includes('IGCSE')));
    assert.equal(hardViolations(preview.doc, preview.doc.lessons).length, 0);
    assert.ok(preview.doc.lessons.every(lesson => {
      const subject = preview.doc.subjects.find(item => item.id === lesson.subjectId);
      return subject?.level === 'IGCSE';
    }));
  });

  it('finds cover for a named teacher who is off tomorrow', () => {
    const doc = schoolTimetable();
    const lesson: Lesson = {
      id: 'tue-maths',
      subjectId: 'maths-p2',
      groupId: 'g-oak',
      teacherId: 'rahman',
      roomId: 'r-a',
      day: 'tue',
      periodId: 'p1',
      campusId: 'main',
    };
    doc.lessons = [lesson];
    const preview = previewTimetableChat(doc, 'Ms Rahman is off tomorrow, find cover', doc.anchorMonday);
    assert.ok(preview);
    assert.equal(preview.confirmable, true);
    assert.ok(preview.changes.some(change => change.kind === 'cover'));
    assert.equal(doc.covers.length, 0);
    assert.ok(preview.doc.covers.length > 0);
    assert.ok(preview.notices.length > 0);
  });

  it('moves a Tuesday room clash and leaves a clean week', () => {
    const doc = schoolTimetable();
    doc.lessons = [
      { id: 'a', subjectId: 'maths-p2', groupId: 'g-oak', teacherId: 'rahman', roomId: 'r-a', day: 'tue', periodId: 'p1', campusId: 'main' },
      { id: 'b', subjectId: 'maths-ig', groupId: 'g-ig', teacherId: 'adeyemi', roomId: 'r-a', day: 'tue', periodId: 'p1', campusId: 'main' },
    ];
    const preview = previewTimetableChat(doc, 'fix the room clashes on Tuesday');
    assert.ok(preview);
    assert.equal(preview.confirmable, true);
    assert.equal(hardViolations(preview.doc, preview.doc.lessons).filter(clash => clash.code === 'room').length, 0);
    assert.equal(doc.lessons[1]?.roomId, 'r-a');
  });

  it('adds maths periods for Primary 5 by level name', () => {
    const doc = schoolTimetable();
    const preview = previewTimetableChat(doc, 'add 2 more maths periods for Primary 5');
    assert.ok(preview);
    assert.equal(preview.confirmable, true);
    const subject = preview.doc.subjects.find(item => item.name === 'Maths' && item.level === 'Primary 5');
    assert.equal(subject?.periodsPerWeek, 2);
    assert.equal(hardViolations(preview.doc, preview.doc.lessons).length, 0);
    assert.equal(preview.doc.lessons.filter(lesson => lesson.subjectId === subject?.id).length, 2);
  });
});
