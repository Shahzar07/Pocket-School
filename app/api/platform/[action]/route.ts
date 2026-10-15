import { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { callerIsAdmin } from '@/lib/api-guard';
import { runGet, runPost } from '@/lib/server/http';
import {
  ActionError,
  adminGrant,
  completeLesson,
  courseOutlineFor,
  ensureAdminBootstrap,
  gradeQuiz,
  grantMonthly,
  grantWelcome,
  lessonContentFor,
  lookupEnrolledStudent,
  messageContacts,
  parentOverview,
  recordUnitQuiz,
  requestParentLink,
  respondParentLink,
  setSubscription,
  syncPublicProfile,
  unlinkChild,
  unlockFormat,
} from '@/lib/server/actions';
import { adminDb } from '@/lib/firebase-admin';
import type { AccessTier } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    switch (action) {
      case 'sparks-unlock':
        return unlockFormat(user.uid, str(body.courseId), str(body.lessonId), str(body.format));
      case 'sparks-welcome':
        return grantWelcome(user.uid);
      case 'sparks-monthly':
        return grantMonthly(user.uid);
      case 'sparks-grant': {
        if (!(await callerIsAdmin(user.uid, user.email))) throw new ActionError('FORBIDDEN', 'Only an admin can grant Sparks.');
        return adminGrant(user.uid, str(body.uid), Number(body.amount), str(body.note));
      }
      case 'sparks-bootstrap':
        return ensureAdminBootstrap(user.uid);
      case 'progress-complete':
        return completeLesson(user.uid, str(body.courseId), str(body.lessonId), Number(body.xpReward) || 50, true);
      case 'unit-quiz':
        return recordUnitQuiz(user.uid, {
          courseId: str(body.courseId),
          unitId: str(body.unitId),
          lessonId: str(body.lessonId),
          responses: Array.isArray(body.responses) ? body.responses as { question: string; selected: string }[] : [],
          timeTakenSeconds: Number(body.timeTakenSeconds) || 0,
          studentName: str(body.studentName),
        });
      case 'quiz-grade':
        return {
          results: await gradeQuiz(
            str(body.courseId),
            str(body.lessonId),
            Array.isArray(body.answers) ? body.answers as { question: string; selected: string }[] : [],
          ),
        };
      case 'parent-request':
        return requestParentLink(user.uid, str(body.parentName), str(body.studentEmail));
      case 'parent-respond':
        return respondParentLink(user.uid, user.email, str(body.linkId), body.approve === true);
      case 'parent-unlink':
        await unlinkChild(user.uid, str(body.childId));
        return { ok: true };
      case 'mark-verified': {
        await adminAuth().updateUser(user.uid, { emailVerified: true });
        await adminDb().doc(`users/${user.uid}`).set({ emailVerified: true }, { merge: true });
        return { ok: true };
      }
      case 'admin-subscription': {
        const tier = Number(body.accessTier) as AccessTier;
        await setSubscription(user.uid, str(body.uid), tier);
        return { ok: true };
      }
      case 'sync-profile':
        await syncPublicProfile(user.uid);
        return { ok: true };
      default:
        throw new ActionError('NOT_FOUND', 'Unknown action.');
    }
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    const courseId = req.nextUrl.searchParams.get('courseId') ?? '';
    const lessonId = req.nextUrl.searchParams.get('lessonId') ?? '';
    switch (action) {
      case 'lesson-content':
        return lessonContentFor(user.uid, courseId, lessonId);
      case 'course-outline':
        return courseOutlineFor(courseId);
      case 'message-contacts': {
        const profile = await adminDb().doc(`users/${user.uid}`).get();
        return { contacts: await messageContacts(user.uid, (profile.data()?.role as string) ?? 'student') };
      }
      case 'parent-overview':
        return parentOverview(user.uid, req.nextUrl.searchParams.get('childId') ?? '');
      case 'teacher-student':
        return lookupEnrolledStudent(user.uid, req.nextUrl.searchParams.get('email') ?? '');
      default:
        throw new ActionError('NOT_FOUND', 'Unknown action.');
    }
  });
}
