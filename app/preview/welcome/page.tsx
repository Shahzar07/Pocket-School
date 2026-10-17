'use client';

import { buildWelcomeState, trackById } from '@/lib/onboarding-course';
import { WelcomeLessonCard, WelcomeResumeCard } from '@/components/onboarding/welcome-board';

const lessons = trackById('student').lessons;
const state = buildWelcomeState({
  track: 'student',
  lessons,
  checks: new Set(lessons.slice(0, 4).map((lesson) => lesson.id)),
  actions: new Set(lessons.slice(0, 5).map((lesson) => lesson.action.id)),
  skipped: false,
});
const current = state.lessons.find((lesson) => !lesson.done) ?? state.lessons[0]!;

/** Static welcome course so the card, stars, and a ticked task can be reviewed without Firebase. */
export default function WelcomePreview() {
  return (
    <main className="min-h-screen bg-[#F6F1E7] px-5 py-8 text-[#1A3C34]">
      <div className="mx-auto max-w-3xl space-y-4">
        <WelcomeResumeCard state={state} onSkip={() => undefined} />
        <WelcomeLessonCard lesson={current} selected={2} note="That check is in once you choose it. The Sparks page is already ticked." />
      </div>
    </main>
  );
}
