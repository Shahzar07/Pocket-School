import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { anyTargetMatch } from './allocation-targets';
import {
  accountRoles,
  becomeInstructorRoles,
  canBecomeInstructor,
  forLearnerView,
  hasAccountRole,
  heldRoles,
  homeForMode,
  instructorOnboarding,
  landingPath,
  learnerSpaceRoles,
  modeRedirect,
  rememberedMode,
  switchableModes,
} from './account-modes';

describe('account roles', () => {
  it('gives every teacher and parent a learner space', () => {
    assert.deepEqual(accountRoles({ role: 'teacher' }), ['student', 'teacher']);
    assert.deepEqual(accountRoles({ role: 'parent' }), ['student', 'parent']);
    assert.deepEqual(accountRoles({ role: 'student' }), ['student']);
  });

  it('keeps admin and institution admin off the switch', () => {
    assert.deepEqual(accountRoles({ role: 'admin' }), ['admin']);
    assert.deepEqual(switchableModes({ role: 'admin' }), []);
    assert.deepEqual(switchableModes({ role: 'institution_admin' }), []);
    assert.equal(canBecomeInstructor({ role: 'admin' }), false);
    assert.equal(landingPath({ role: 'admin' }, 'student'), '/dashboard/admin');
    assert.equal(landingPath({ role: 'institution_admin' }, 'teacher'), '/dashboard/institution');
  });

  it('does not treat an implied learner space as a stored role', () => {
    assert.equal(hasAccountRole({ role: 'teacher' }, 'student'), false);
    assert.equal(hasAccountRole({ role: 'teacher' }, 'teacher'), true);
    assert.equal(hasAccountRole({ role: 'teacher', roles: ['teacher', 'student'] }, 'student'), true);
    assert.deepEqual(heldRoles({ role: 'student', roles: ['student', 'teacher'] }), ['student', 'teacher']);
  });

  it('remembers the last mode and opens that dashboard', () => {
    const teacher = { role: 'teacher', roles: ['teacher', 'student'] };
    assert.equal(rememberedMode('student', teacher), 'student');
    assert.equal(rememberedMode('parent', teacher), 'teacher');
    assert.equal(homeForMode('student'), '/dashboard/student');
    assert.equal(homeForMode('teacher'), '/dashboard/teacher');
    assert.equal(homeForMode('parent'), '/dashboard/parent');
    assert.equal(landingPath(teacher, 'student'), '/dashboard/student');
    assert.equal(modeRedirect('/dashboard/teacher/gradebook', 'student'), '/dashboard/student');
    assert.equal(modeRedirect('/dashboard/parent', 'student'), '/dashboard/student');
    assert.equal(modeRedirect('/dashboard/student/courses', 'student'), null);
    assert.equal(modeRedirect('/dashboard/admin', 'student'), null);
    assert.equal(modeRedirect('/dashboard/profile', 'teacher'), null);
  });

  it('adds teacher without admin and without publishing', () => {
    const roles = becomeInstructorRoles({ role: 'student' });
    assert.deepEqual(roles, ['student', 'teacher']);
    assert.equal(roles?.includes('admin' as never), false);
    const parent = becomeInstructorRoles({ role: 'parent' });
    assert.deepEqual(parent, ['student', 'teacher', 'parent']);
    assert.equal(becomeInstructorRoles({ role: 'teacher' }), null);
    const patch = instructorOnboarding(
      { role: 'student' },
      { headline: 'Year 8 science', subject: 'Biology', acceptedReview: true },
    );
    assert.deepEqual(patch?.roles, ['student', 'teacher']);
    assert.equal(patch?.instructor.public, false);
    assert.equal('status' in (patch ?? {}), false);
    assert.equal(instructorOnboarding({ role: 'student' }, { headline: 'Science', subject: 'Biology', acceptedReview: false }), null);
  });

  it('writes the learner space once', () => {
    assert.deepEqual(learnerSpaceRoles({ role: 'teacher' }), ['student', 'teacher']);
    assert.equal(learnerSpaceRoles({ role: 'teacher', roles: ['student', 'teacher'] }), null);
    assert.deepEqual(learnerSpaceRoles({ role: 'parent' }), ['student', 'parent']);
    assert.equal(learnerSpaceRoles({ role: 'admin' }), null);
    assert.equal(learnerSpaceRoles({ role: 'student' }), null);
  });

  it('keeps taught classes and monitored children out of learning', () => {
    const shelf = forLearnerView([
      { id: 'enrol', ownerId: 'other', studentId: 'me' },
      { id: 'own-course', ownerId: 'me', studentId: 'me' },
      { id: 'class', ownerId: 'me' },
      { id: 'roster', ownerId: 'me', studentId: 'pupil' },
      { id: 'child', childId: 'amina', studentId: 'amina' },
      { id: 'sparks', studentId: 'me' },
    ], 'me');
    assert.deepEqual(shelf.map(item => item.id), ['enrol', 'own-course', 'sparks']);
  });

  it('matches allocation by held roles, not by a dashboard mode', () => {
    const teacher = { role: 'teacher', roles: ['teacher', 'student'] };
    assert.equal(anyTargetMatch(['students'], teacher).hit, true);
    assert.equal(anyTargetMatch(['teachers'], teacher).hit, true);
    assert.equal(anyTargetMatch(['students'], { role: 'teacher' }).hit, false);
    assert.equal(anyTargetMatch(['parents'], { role: 'parent', roles: ['parent', 'student'] }).hit, true);
  });
});
