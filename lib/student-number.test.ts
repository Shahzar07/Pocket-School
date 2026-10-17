import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STUDENT_NUMBER_ALPHABET,
  isStudentNumber,
  learnerLevelLabel,
  linkConfirmer,
  nextFreeStudentNumber,
  studentCodeFromScan,
  studentJoinUrl,
} from './student-number';

describe('student numbers', () => {
  it('builds a join URL and reads the code back from a scan', () => {
    const code = 'PS-AB23-CD45';
    const url = studentJoinUrl('https://poketschool.ai/', code);
    assert.equal(url, 'https://poketschool.ai/join/PS-AB23-CD45');
    assert.equal(studentCodeFromScan(url), code);
    assert.equal(studentCodeFromScan('ps ab23 cd45'), code);
    assert.equal(isStudentNumber(code), true);
    assert.equal(studentCodeFromScan('not-a-code'), '');
  });

  it('skips a code that is already taken', () => {
    let call = 0;
    const random = () => {
      call += 1;
      const slot = Math.floor((call - 1) / 8);
      return (slot === 0 ? 0 : 1) / STUDENT_NUMBER_ALPHABET.length;
    };
    const first = nextFreeStudentNumber(new Set(), random, 1);
    call = 0;
    const second = nextFreeStudentNumber(new Set([first ?? '']), random, 2);
    assert.equal(first, 'PS-AAAA-AAAA');
    assert.equal(second, 'PS-BBBB-BBBB');
  });

  it('asks the institution admin to confirm a learner under 13', () => {
    assert.equal(linkConfirmer('under13'), 'institution_admin');
    assert.equal(linkConfirmer(undefined), 'institution_admin');
    assert.equal(linkConfirmer('teen'), 'student');
    assert.equal(linkConfirmer('adult'), 'student');
  });

  it('shows a level name and skips a year number', () => {
    assert.equal(learnerLevelLabel({ yearGroup: 'Year 10', level: 'igcse_alevel' }), 'IGCSE & A-Level');
    assert.equal(learnerLevelLabel({ yearGroup: 'IGCSE' }), 'IGCSE');
  });
});
