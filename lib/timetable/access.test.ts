import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TIMETABLER_PRICE_NOTE, canEditPersonal, canEditSchool, canUseMultipleCampuses, timetableEdition } from './access';

describe('timetabler packaging', () => {
  it('gates personal, school, and enterprise without inventing a price', () => {
    assert.equal(TIMETABLER_PRICE_NOTE, 'TBC by Harry');
    assert.equal(timetableEdition({ role: 'teacher', permissions: ['addon:et_ai_timetabler'] }), 'personal');
    assert.equal(canEditPersonal({ role: 'teacher', permissions: ['addon:et_ai_timetabler'] }), true);
    assert.equal(timetableEdition({ role: 'teacher' }), 'view');
    assert.equal(timetableEdition({ role: 'institution_admin', permissions: ['addon:et_ai_timetabler'], plan: 'institute' }), 'school');
    assert.equal(canEditSchool({ role: 'institution_admin', permissions: ['addon:et_ai_timetabler'], plan: 'institute' }), true);
    assert.equal(timetableEdition({ role: 'institution_admin', permissions: ['addon:et_ai_timetabler'], plan: 'enterprise' }), 'enterprise');
    assert.equal(canUseMultipleCampuses({ role: 'institution_admin', permissions: ['addon:et_ai_timetabler'], plan: 'enterprise' }), true);
    assert.equal(canUseMultipleCampuses({ role: 'institution_admin', permissions: ['addon:et_ai_timetabler'], plan: 'institute' }), false);
    assert.equal(timetableEdition({ role: 'student' }), 'view');
    assert.equal(timetableEdition({ role: 'parent' }), 'view');
    assert.equal(timetableEdition({ role: 'institution_admin' }), 'locked');
  });
});
