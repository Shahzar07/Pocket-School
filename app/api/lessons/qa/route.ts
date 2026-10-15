import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { askLesson, listLessonQuestions, publishLessonReply } from '@/lib/server/scope-c';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    if (str(body.questionId)) return publishLessonReply(user.uid, str(body.questionId), str(body.reply));
    return askLesson(user.uid, {
      courseId: str(body.courseId),
      lessonId: str(body.lessonId),
      lessonTitle: str(body.lessonTitle),
      body: str(body.body),
    });
  });
}

export async function GET(req: NextRequest) {
  return runGet(req, async (user) => listLessonQuestions(
    user.uid,
    req.nextUrl.searchParams.get('lessonId') ?? '',
    req.nextUrl.searchParams.get('courseId') ?? '',
  ));
}
