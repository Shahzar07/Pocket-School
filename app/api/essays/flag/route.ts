import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { ESSAY_FLAG_MESSAGE } from '@/lib/essays/config';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { notifyParents, notifyUser } from '@/lib/server/device-push';

/**
 * Records an ET Essays flag on the student integrity page and tells the
 * linked parents and teachers. A missing admin setup still leaves the flag
 * on the essay itself.
 */
export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) return NextResponse.json({ notified: 0, saved: false });
  try {
    const user = await requireUser(req);
    if (isNextResponse(user)) return NextResponse.json({ notified: 0, saved: false });
    const payload = await req.json().catch(() => ({})) as {
      title?: string;
      studentName?: string;
      evidence?: { label?: string; detail?: string }[];
      score?: number;
    };
    const profile = await loadUser(user.uid);
    const studentName = String(payload.studentName || profile?.name || profile?.displayName || 'A student').slice(0, 120);
    const title = String(payload.title || 'Essay').slice(0, 200);
    const evidence = Array.isArray(payload.evidence)
      ? payload.evidence
        .filter(item => item && typeof item.label === 'string' && typeof item.detail === 'string')
        .slice(0, 8)
        .map(item => ({ label: item.label, detail: item.detail }))
      : [];
    const message = `${studentName}'s essay "${title}" appears AI-generated. ET Essays has not given a grade. A rewrite is required.`;
    const teacherIds = await teacherIdsFor(user.uid);
    const ref = await adminDb().collection('integrity_cases').add({
      studentId: user.uid,
      studentName,
      teacherId: teacherIds[0] ?? '',
      teacherName: 'Teacher',
      assignmentTitle: title,
      source: 'et-essays',
      decision: 'pending',
      automaticPenalty: false,
      level: 'concern',
      score: typeof payload.score === 'number' ? payload.score : 0,
      evidence,
      studentSummary: ESSAY_FLAG_MESSAGE,
      recommendation: 'ET Essays withheld the grade. A teacher can release marking if this flag is a false positive.',
      createdAt: new Date().toISOString(),
    });
    await adminDb().doc(`integrity_cases/${ref.id}/audit/opened`).set({
      at: new Date().toISOString(),
      actorId: user.uid,
      actorName: studentName,
      action: 'opened',
      note: 'ET Essays flagged a submission that appears AI-generated. No grade was given.',
    });
    const parents = await notifyParents(user.uid, studentName, {
      title: 'ET Essays',
      message,
      type: 'integrity',
      link: '/dashboard/parent/integrity',
      pref: 'integrity',
    });
    await Promise.all(teacherIds.map(teacherId => notifyUser({
      userId: teacherId,
      title: 'ET Essays',
      message,
      type: 'integrity',
      link: '/studio/essays/review',
      pref: 'integrity',
    })));
    return NextResponse.json({ notified: parents + teacherIds.length, saved: true, caseId: ref.id });
  } catch (error) {
    console.error('ET Essays flag', error);
    return NextResponse.json({ notified: 0, saved: false });
  }
}

async function teacherIdsFor(studentId: string): Promise<string[]> {
  try {
    const enrolled = await adminDb().collectionGroup('enrollments').where('studentId', '==', studentId).limit(20).get();
    const ids = new Set<string>();
    for (const row of enrolled.docs) {
      const courseId = row.ref.parent.parent?.id;
      if (!courseId) continue;
      const course = await adminDb().doc(`courses/${courseId}`).get();
      const owner = course.data()?.ownerId;
      if (typeof owner === 'string' && owner) ids.add(owner);
    }
    return [...ids];
  } catch (error) {
    console.error('ET Essays teacher lookup', error);
    return [];
  }
}
