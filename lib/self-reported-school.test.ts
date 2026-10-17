import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  leaderboardSchool,
  schoolKey,
  schoolStripMinimum,
  visibleSchoolNames,
} from './self-reported-school';

describe('self-reported schools', () => {
  it('groups punctuation variants in one place and keeps another region apart', () => {
    const selangor = schoolKey('my', 'Selangor', "St. Mary's  School");
    assert.equal(selangor, schoolKey('MY', 'selangor', 'St Marys School'));
    assert.notEqual(selangor, schoolKey('MY', 'Penang', 'St Marys School'));
    assert.equal(schoolKey('MY', 'Selangor', '   '), '');
  });

  it('shows a verified institution name ahead of a typed school, and neither when membership has no name', () => {
    assert.equal(leaderboardSchool({
      institutionId: 'north',
      institutionName: 'North Academy',
      selfReportedName: 'My Tuition Centre',
    }), 'North Academy');
    assert.equal(leaderboardSchool({
      institutionId: '',
      selfReportedName: '  My Tuition Centre ',
    }), 'My Tuition Centre');
    assert.equal(leaderboardSchool({ institutionId: 'north', institutionName: '' }), '');
  });

  it('publishes approved names above the threshold and opted-in institutions', () => {
    const names = visibleSchoolNames({
      minimum: 3,
      unregistered: [
        { name: 'Harbour Tuition', count: 4, approved: true },
        { name: 'Harbour Tuition', count: 4, approved: true },
        { name: 'Small Class', count: 2, approved: true },
        { name: 'Quiet School', count: 9, approved: false },
        { name: 'Merged School', count: 8, approved: true, mergedInto: 'harbour' },
      ],
      institutions: [
        { name: 'North Academy', optedIn: true },
        { name: 'South College', optedIn: false },
      ],
    });
    assert.deepEqual(names, ['Harbour Tuition', 'North Academy']);
    assert.equal(schoolStripMinimum('0'), 1);
    assert.equal(schoolStripMinimum('nope'), 3);
  });
});
