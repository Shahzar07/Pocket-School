import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { approveOptions, saveChoice, suggestBlocks } from './options';
import { schoolTimetable } from './seed';

describe('option blocks', () => {
  it('separates subjects a student wants to take together', () => {
    const subjects = schoolTimetable().optionSubjects;
    const wishes = [
      { studentId: 's-noor', studentName: 'Noor Adeyemi', subjectIds: ['opt-physics', 'opt-history'] },
      { studentId: 's-harun', studentName: 'Harun Okonkwo', subjectIds: ['opt-physics', 'opt-computing'] },
      { studentId: 's-mei', studentName: 'Mei Lim', subjectIds: ['opt-history', 'opt-art'] },
    ];
    const plan = suggestBlocks(subjects, wishes, 3);
    assert.equal(plan.satisfied, wishes.length);
    assert.deepEqual(plan.clashes, []);
    const forced = suggestBlocks(subjects, wishes, 1);
    assert.ok(forced.clashes.length > 0);
    assert.ok(forced.satisfied < wishes.length);
  });

  it('enrols the students who chose each subject when an admin approves', () => {
    let doc = schoolTimetable();
    doc = saveChoice(doc, { studentId: 's-noor', blockId: 'block-a', subjectIds: ['opt-physics'] });
    doc = saveChoice(doc, { studentId: 's-harun', blockId: 'block-a', subjectIds: ['opt-physics'] });
    doc = saveChoice(doc, { studentId: 's-noor', blockId: 'block-b', subjectIds: ['opt-history'] });
    const approved = approveOptions(doc, '2026-10-19T09:00:00.000Z', 'inst-1');
    const physics = approved.groups.find(group => group.id === 'set-opt-physics');
    const history = approved.groups.find(group => group.id === 'set-opt-history');
    assert.deepEqual(physics?.studentIds, ['s-harun', 's-noor']);
    assert.equal(physics?.level, 'IGCSE');
    assert.deepEqual(history?.studentIds, ['s-noor']);
    assert.equal(approved.audit[0]?.action, 'options-approve');
  });
});
