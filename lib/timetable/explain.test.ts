import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyParsedConstraint, parseNaturalConstraint } from './explain';
import { schoolTimetable } from './seed';

describe('plain-language constraints', () => {
  it('reads a Friday afternoon constraint for Mr Chen', () => {
    const doc = schoolTimetable();
    const parsed = parseNaturalConstraint("Mr Chen can't do Friday afternoons", doc.staff, doc.periods);
    assert.ok(!('error' in parsed));
    if ('error' in parsed) return;
    assert.equal(parsed.staffId, 'chen');
    assert.deepEqual(parsed.slots, ['fri:p5', 'fri:p6']);
    const next = applyParsedConstraint(doc, parsed);
    assert.deepEqual(next.staff.find(person => person.id === 'chen')?.unavailable, ['fri:p5', 'fri:p6']);
  });

  it('does not invent a member of staff', () => {
    const parsed = parseNaturalConstraint("Mr Nobody can't do Monday mornings", schoolTimetable().staff, schoolTimetable().periods);
    assert.ok('error' in parsed);
  });
});
