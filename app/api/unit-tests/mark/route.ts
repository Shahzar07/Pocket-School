import { NextRequest } from 'next/server';
import { runPost } from '@/lib/server/http';
import { markUnitTestAttempt } from '@/lib/server/mark-unit-test';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Marks a unit test from the stored paper.
 * `score`, `passed`, and `percentage` on the request are ignored.
 */
export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    const answers = Array.isArray(body.answers)
      ? body.answers.filter((row): row is { questionId?: string; selected?: string } => !!row && typeof row === 'object')
      : [];
    const responses = Array.isArray(body.responses)
      ? body.responses.filter((row): row is { selected?: string } => !!row && typeof row === 'object')
      : [];
    return markUnitTestAttempt(user.uid, {
      courseId: str(body.courseId),
      unitId: str(body.unitId),
      lessonId: str(body.lessonId),
      answers,
      responses,
      timeTakenSeconds: Number(body.timeTakenSeconds) || 0,
    });
  });
}
