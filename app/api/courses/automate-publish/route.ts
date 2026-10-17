import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { callerOwnsInstitution } from '@/lib/server/institution-activate';
import { loadAutomation, logAutomation } from '@/lib/server/automation-store';
import { brandRuleCheck, courseAutomation } from '@/lib/site-automation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Publishing needs the server account.' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => null);
  const courseId = body && typeof body.courseId === 'string' ? body.courseId.trim() : '';
  if (!courseId) return NextResponse.json({ error: 'Choose a course.' }, { status: 400 });
  const snap = await adminDb().doc(`courses/${courseId}`).get();
  if (!snap.exists) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
  const data = snap.data() ?? {};
  const ownerId = typeof data.ownerId === 'string' ? data.ownerId : '';
  const institutionId = typeof data.institutionId === 'string' ? data.institutionId : '';
  const owns = ownerId === user.uid || (institutionId ? await callerOwnsInstitution(user.uid, institutionId) : false);
  if (!owns) return NextResponse.json({ error: 'You cannot publish this course.' }, { status: 403 });

  const title = typeof data.title === 'string' ? data.title : '';
  const description = typeof data.description === 'string' ? data.description : '';
  const level = typeof data.level === 'string' ? data.level : '';
  const brand = brandRuleCheck({ title, description, level });
  const settings = await loadAutomation();
  const wantsMarketplace = body.wantsMarketplace === true
    || data.publishScope === 'marketplace'
    || data.visibility === 'marketplace';
  const decision = courseAutomation({
    libraryAuto: settings.rules.teacher_library,
    marketplaceAuto: settings.rules.marketplace_listing,
    wantsMarketplace,
    brandOk: brand.ok,
    issues: brand.issues,
  });
  await snap.ref.set({
    status: decision.status,
    isPublic: decision.isPublic,
    libraryApproved: decision.library === 'approved',
    marketplaceApproved: decision.marketplace === 'approved',
    marketplacePending: decision.marketplace === 'pending',
    brandIssues: brand.issues,
    automationNote: decision.note,
  }, { merge: true });
  await logAutomation({
    rule: wantsMarketplace ? 'marketplace_listing' : 'teacher_library',
    outcome: decision.held || decision.library === 'pending' ? 'held' : 'auto',
    summary: `${title || 'Course'}: ${decision.note}`,
    actorId: user.uid,
    refId: courseId,
  });
  return NextResponse.json({ ...decision, issues: brand.issues });
}
