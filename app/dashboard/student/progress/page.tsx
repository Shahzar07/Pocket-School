'use client';

import { ProgressScreen } from '@/components/progress/progress-screen';
import { ACTIVE_TIME_COPY } from '@/lib/activity/active-time';

export default function StudentProgressPage() {
  return (
    <ProgressScreen
      scope="student"
      mode="student"
      eyebrow="ET AI"
      title="My progress"
      description={`A short plan from the lessons already on your record. Take the next one when you are ready. ${ACTIVE_TIME_COPY}`}
    />
  );
}
