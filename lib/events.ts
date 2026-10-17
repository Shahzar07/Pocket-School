/**
 * Shared learning events for Poket School.
 *
 * Onboarding and unit tests in other changes should emit these names.
 * They must not import the badge engine, and the engine does not import them.
 *
 * Send a signed-in POST to `/api/gamification/event`:
 * `{ event, eventId?, payload? }`.
 * `eventId` makes a retry a no-op. Awards are also idempotent per badge.
 *
 * `lesson.first_complete` is the exception. The server emits it when a lesson
 * is completed. Clients must not post it.
 */

export const LEARNING_EVENTS = {
  onboardingComplete: 'onboarding.complete',
  lessonFirstComplete: 'lesson.first_complete',
  unitTestPass: 'unit_test.pass',
  unitTestPerfect: 'unit_test.perfect',
  unitTestComeback: 'unit_test.comeback',
  streakDay: 'streak.day',
  studySession: 'study.session',
  etAiQuestion: 'et_ai.question',
  researchHelperCited: 'research.helper_cited',
  readsChapterFinished: 'reads.chapter_finished',
  readsBookFinished: 'reads.book_finished',
  plannerWeekKept: 'planner.week_kept',
  peerHelp: 'peer.help',
  levelUp: 'level.up',
  courseComplete: 'course.complete',
  parentLinked: 'parent.linked',
  teacherCoursePublished: 'teacher.course_published',
  teacherLessonPlan: 'teacher.lesson_plan',
  teacherClassAllPass: 'teacher.class_all_pass',
  institutionSetupComplete: 'institution.setup_complete',
  institutionActiveStudents: 'institution.active_students',
} as const;

export type LearningEventName = (typeof LEARNING_EVENTS)[keyof typeof LEARNING_EVENTS];

const EVENT_SET = new Set<string>(Object.values(LEARNING_EVENTS));

export function isLearningEvent(value: string | null | undefined): value is LearningEventName {
  return typeof value === 'string' && EVENT_SET.has(value);
}

/** Events a signed-in client may post. First-lesson completion is server-only. */
export function isClientLearningEvent(value: string | null | undefined): value is LearningEventName {
  return isLearningEvent(value) && value !== LEARNING_EVENTS.lessonFirstComplete;
}
