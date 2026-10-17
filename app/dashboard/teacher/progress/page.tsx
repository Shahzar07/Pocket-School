'use client';

import { ProgressScreen } from '@/components/progress/progress-screen';

export default function TeacherProgressPage() {
  return (
    <ProgressScreen
      scope="class"
      mode="teacher"
      eyebrow="Class"
      title="Class risk"
      description="Open progress alerts for your classes, highest severity first. Acknowledge, assign, note, or resolve each one."
    />
  );
}
