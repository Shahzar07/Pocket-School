import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hardViolations } from './clashes';
import { approveCover, coverLoad, coverNotices, proposeCover, setStaffStatus } from './cover';
import { schoolTimetable } from './seed';
import { solveTimetable } from './solver';

describe('cover', () => {
  it('offers a qualified free teacher and records notices and a fair load', () => {
    const solved = solveTimetable(schoolTimetable());
    let doc = { ...schoolTimetable(), lessons: solved.lessons, quality: solved.quality, unmet: solved.unmet };
    assert.deepEqual(hardViolations(doc, doc.lessons), []);
    doc = setStaffStatus(doc, 'rahman', 'leave');
    const proposals = proposeCover(doc, 'rahman', '2026-10-19', 'leave');
    assert.ok(proposals.length > 0);
    assert.ok(proposals.every(proposal => proposal.coverTeacherId !== 'rahman'));
    const approved = approveCover(doc, proposals, '2026-10-19T10:00:00.000Z', 'inst-1');
    const notices = coverNotices(doc, proposals);
    assert.ok(notices.some(notice => notice.userId === 't-rahman'));
    assert.ok(notices.some(notice => notice.userId === 's-amina'));
    assert.ok(notices.some(notice => notice.userId === 'parent-amina'));
    const load = coverLoad(approved);
    const coverIds = new Set(proposals.map(proposal => proposal.coverTeacherId));
    assert.ok(load.filter(row => coverIds.has(row.teacherId)).every(row => row.count > 0));
  });
});
