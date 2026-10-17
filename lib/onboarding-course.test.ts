import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WELCOME_SPARKS,
  WELCOME_TRACKS,
  buildWelcomeState,
  certificateIncludesStudentNumber,
  choiceCorrect,
  hrefMatches,
  lessonTranslationFields,
  mergeOutline,
  recordsFromProfile,
  shouldStampStudentNumber,
  starsEarned,
  streakEarned,
  trackComplete,
  trackForProfile,
  welcomeBadge,
  welcomeCourseSeed,
  welcomeLessonSeeds,
  type OnboardingLesson,
} from './onboarding-course';

const YEAR = /\b(Year|Grade|Form)\s+\d+/i;
const CALENDAR = /\b(19|20)\d{2}\b/;

function rows(lessons: readonly { id: string }[], doneUntil: number) {
  return lessons.map((lesson, index) => ({
    lessonId: lesson.id,
    checkCorrect: index < doneUntil,
    actionDone: index < doneUntil,
  }));
}

describe('welcome course', () => {
  it('gives every role a short free track', () => {
    assert.equal(WELCOME_TRACKS.length, 5);
    assert.deepEqual(WELCOME_TRACKS.map((track) => track.id), ['student', 'parent', 'teacher', 'institution', 'independent']);
    for (const track of WELCOME_TRACKS) {
      assert.ok(track.lessons.length >= 5 && track.lessons.length <= 8, track.id);
      const ids = new Set<string>();
      for (const lesson of track.lessons) {
        assert.ok(lesson.minutes === 2 || lesson.minutes === 3);
        assert.equal(lesson.check.options.length, 3);
        assert.ok(lesson.check.answer >= 0 && lesson.check.answer <= 2);
        assert.ok(lesson.action.href.startsWith('/'));
        assert.ok(!ids.has(lesson.id));
        ids.add(lesson.id);
      }
    }
  });

  it('keeps brand names and level language', () => {
    const blob = JSON.stringify(WELCOME_TRACKS);
    assert.match(blob, /Poket School/);
    assert.match(blob, /ET AI/);
    assert.match(blob, /ET Maths/);
    assert.match(blob, /Parent Explainer/);
    assert.doesNotMatch(blob, /Pocket School/);
    assert.doesNotMatch(blob, YEAR);
    assert.doesNotMatch(blob, CALENDAR);
  });

  it('maps each account onto one track', () => {
    assert.equal(trackForProfile({ role: 'student', institutionId: 'school' }), 'student');
    assert.equal(trackForProfile({ role: 'student' }), 'independent');
    assert.equal(trackForProfile({ role: 'parent' }), 'parent');
    assert.equal(trackForProfile({ role: 'teacher' }), 'teacher');
    assert.equal(trackForProfile({ role: 'institution_admin', institutionId: 'school' }), 'institution');
    assert.equal(trackForProfile({ role: 'admin' }), 'independent');
    assert.equal(trackForProfile({ role: 'teacher', roles: ['teacher', 'parent'], mode: 'parent' }), 'parent');
    assert.equal(trackForProfile({ role: 'teacher', roles: ['teacher', 'student'], mode: 'student', institutionId: 'school' }), 'student');
  });

  it('awards stars, a streak, and a Sparks-free badge', () => {
    const lessons = WELCOME_TRACKS[0]!.lessons;
    assert.equal(starsEarned(rows(lessons, 3)), 3);
    assert.equal(streakEarned(lessons, rows(lessons, 3)), 3);
    assert.equal(streakEarned(lessons, [
      { lessonId: lessons[1]!.id, checkCorrect: true, actionDone: true },
    ]), 0);
    assert.equal(trackComplete(lessons, rows(lessons, lessons.length)), true);
    assert.equal(trackComplete(lessons, rows(lessons, lessons.length - 1)), false);
    assert.equal(WELCOME_SPARKS, 0);
    assert.equal(welcomeBadge('student').sparks, 0);
    assert.equal(welcomeBadge('parent').name, 'Welcome star');
  });

  it('puts the student number on student certificates only', () => {
    assert.equal(certificateIncludesStudentNumber('student'), true);
    assert.equal(certificateIncludesStudentNumber('independent'), true);
    assert.equal(certificateIncludesStudentNumber('parent'), false);
    assert.equal(certificateIncludesStudentNumber('teacher'), false);
    assert.equal(certificateIncludesStudentNumber('institution'), false);
    assert.equal(shouldStampStudentNumber({ courseId: 'onboarding-welcome', moduleId: 'parent', role: 'parent' }), false);
    assert.equal(shouldStampStudentNumber({ courseId: 'onboarding-welcome', moduleId: 'student', role: 'student' }), true);
    assert.equal(shouldStampStudentNumber({ courseId: 'other-course', role: 'parent' }), true);
  });

  it('ticks a real page, and a linked child, without a fake checkbox', () => {
    const student = WELCOME_TRACKS[0]!.lessons;
    const courses = student.find((lesson) => lesson.id === 'courses')!;
    assert.equal(hrefMatches(courses.action.href, '/dashboard/student/courses/abc', true), true);
    assert.equal(hrefMatches('/dashboard/parent', '/dashboard/parent/billing'), false);
    assert.equal(hrefMatches('/ai-studio?mode=teacher-toolkit', '/ai-studio?mode=teacher-toolkit'), true);
    assert.equal(hrefMatches('/ai-studio?mode=teacher-toolkit', '/ai-studio?mode=parent-explainer'), false);
    assert.equal(hrefMatches('/dashboard/institution#academy-invite', '/dashboard/institution#academy-invite'), true);
    assert.equal(hrefMatches('/dashboard/institution#academy-invite', '/dashboard/institution'), false);
    assert.deepEqual(recordsFromProfile({ studentNumber: 'PS-K7NP-4R2C', childIds: ['child'] }), ['student_code', 'parent_link']);
    assert.deepEqual(recordsFromProfile({ studentNumber: 'nope', childIds: [] }), []);
  });

  it('keeps a super admin edit and drops a deleted lesson', () => {
    const stored = welcomeLessonSeeds().find((module) => module.moduleId === 'student')!.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.id === 'meet-et' ? 'Say hello to ET AI' : lesson.title,
      body: lesson.aiOutputs.text,
      question: lesson.aiOutputs.quiz[0]!.question,
      options: lesson.aiOutputs.quiz[0]!.options,
      answer: lesson.aiOutputs.quiz[0]!.answer,
      actionId: lesson.activity.instructions,
      actionLabel: lesson.activity.title,
      actionHref: lesson.activity.modelAnswer,
    })).filter((lesson) => lesson.id !== 'sparks');
    const merged = mergeOutline('student', stored);
    assert.equal(merged.find((lesson) => lesson.id === 'meet-et')?.title, 'Say hello to ET AI');
    assert.equal(merged.some((lesson) => lesson.id === 'sparks'), false);
    assert.equal(merged.length, WELCOME_TRACKS[0]!.lessons.length - 1);
    const edited = merged[0] as OnboardingLesson;
    assert.equal(choiceCorrect(edited, edited.check.answer), true);
  });

  it('seeds a free course a curriculum admin can open', () => {
    const course = welcomeCourseSeed();
    assert.equal(course.price, 0);
    assert.equal(course.priceType, 'FREE');
    assert.equal(course.kind, 'curriculum');
    assert.equal('yearGroup' in course, false);
    assert.equal('seedKey' in course, false);
    const modules = welcomeLessonSeeds();
    assert.equal(modules.length, 5);
    assert.equal(modules[0]!.lessons[0]!.aiOutputs.quiz[0]!.answer, 'Explaining, quizzing, and practising with you');
  });

  it('hides the resume card after skip or the last star', () => {
    const lessons = WELCOME_TRACKS[3]!.lessons;
    const open = buildWelcomeState({
      track: 'institution',
      lessons,
      checks: new Set([lessons[0]!.id]),
      actions: new Set([lessons[0]!.action.id]),
      skipped: false,
    });
    assert.equal(open.showCard, true);
    assert.equal(open.stars, 1);
    assert.equal(open.streak, 1);
    const skipped = buildWelcomeState({
      track: 'institution',
      lessons,
      checks: new Set(),
      actions: new Set(),
      skipped: true,
    });
    assert.equal(skipped.showCard, false);
    const done = buildWelcomeState({
      track: 'institution',
      lessons,
      checks: new Set(lessons.map((lesson) => lesson.id)),
      actions: new Set(lessons.map((lesson) => lesson.action.id)),
      skipped: false,
      certificateId: 'cert',
    });
    assert.equal(done.complete, true);
    assert.equal(done.showCard, false);
    assert.equal(done.certificateId, 'cert');
    const fields = lessonTranslationFields(open.lessons[0]!);
    assert.match(fields.body, /Poket School|checklist|academy/i);
    assert.equal(typeof fields.option0, 'string');
  });
});
