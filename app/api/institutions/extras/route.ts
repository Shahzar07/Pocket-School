import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { callerOwnsInstitution } from '@/lib/server/institution-activate';
import {
  addReunionPhoto,
  applyToOpening,
  buyReunionTicket,
  giveToCampaign,
  hideEndorsement,
  hideSkill,
  institutionCareer,
  learnerCareer,
  parentAchievementPdf,
  postOpening,
  proposeTalk,
  refreshSkills,
  reopenWall,
  reviewOpening,
  reviewTalkRequest,
  revokeSchoolEndorsement,
  rsvpReunion,
  saveCampaign,
  saveInterests,
  saveMatch,
  saveOpportunity,
  saveReunion,
  saveSkillMap,
  setGiving,
  setParentConsent,
  writeEndorsement,
} from '@/lib/server/institution-extras-store';

export const dynamic = 'force-dynamic';

async function actor(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  return requireUser(req);
}

async function owns(uid: string, email: string | undefined, role: string | undefined, adminRole: string | undefined, institutionId: string) {
  const claims = { role, adminRole };
  return (await callerOwnsInstitution(uid, institutionId)) || callerIsAdmin(uid, email, claims);
}

export async function GET(req: NextRequest) {
  const user = await actor(req);
  if (isNextResponse(user)) return user;
  const view = req.nextUrl.searchParams.get('view') ?? 'learner';
  if (view === 'achievement') {
    const studentId = req.nextUrl.searchParams.get('studentId')?.trim() || user.uid;
    const file = await parentAchievementPdf(user.uid, studentId);
    if ('error' in file) return NextResponse.json(file, { status: 403 });
    return new NextResponse(Buffer.from(file.pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="achievement.pdf"' },
    });
  }
  if (view === 'institution') {
    const institutionId = req.nextUrl.searchParams.get('institutionId')?.trim() ?? '';
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    if (!(await owns(user.uid, user.email, user.role, user.adminRole, institutionId))) {
      return NextResponse.json({ error: 'This academy is not on your account.' }, { status: 403 });
    }
    return NextResponse.json(await institutionCareer(institutionId));
  }
  return NextResponse.json(await learnerCareer(user.uid));
}

export async function POST(req: NextRequest) {
  const user = await actor(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const institutionId = typeof body.institutionId === 'string' ? body.institutionId.trim() : '';

  if (action === 'interests') return NextResponse.json(await saveInterests(user.uid, body.interests));
  if (action === 'refresh-skills') return NextResponse.json({ skills: await refreshSkills(user.uid) });
  if (action === 'hide-skill') {
    const saved = await hideSkill(user.uid, typeof body.skillId === 'string' ? body.skillId : '', body.visible === true);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'hide-endorsement') {
    const saved = await hideEndorsement(user.uid, typeof body.id === 'string' ? body.id : '', body.visible === true);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'parent-consent') return NextResponse.json(await setParentConsent(user.uid, body.consent === true));
  if (action === 'save-match') {
    const saved = await saveMatch(user.uid, typeof body.opportunityId === 'string' ? body.opportunityId : '', typeof body.cvVersionId === 'string' ? body.cvVersionId : '');
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'apply-opening') {
    const saved = await applyToOpening(user.uid, institutionId, typeof body.openingId === 'string' ? body.openingId : '', typeof body.cvVersionId === 'string' ? body.cvVersionId : '');
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'give') {
    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    const saved = await giveToCampaign(user.uid, institutionId, typeof body.campaignId === 'string' ? body.campaignId : '', amount);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'rsvp') {
    const saved = await rsvpReunion(user.uid, institutionId, typeof body.reunionId === 'string' ? body.reunionId : '', body.going !== false);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'ticket') {
    const saved = await buyReunionTicket(user.uid, institutionId, typeof body.reunionId === 'string' ? body.reunionId : '');
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'album') {
    const saved = await addReunionPhoto(user.uid, institutionId, typeof body.reunionId === 'string' ? body.reunionId : '', body.caption, body.url);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'propose-talk') {
    const saved = await proposeTalk(user.uid, institutionId, body);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'post-opening') {
    const saved = await postOpening(user.uid, institutionId, body);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'endorse') {
    const saved = await writeEndorsement(user.uid, typeof body.studentId === 'string' ? body.studentId : '', body.body);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }

  if (!institutionId && action !== 'save-skill' && action !== 'save-opportunity') {
    return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
  }
  const platform = body.platform === true;
  const allowed = platform
    ? await callerIsAdmin(user.uid, user.email, { role: user.role, adminRole: user.adminRole })
    : await owns(user.uid, user.email, user.role, user.adminRole, institutionId);
  if (!allowed) return NextResponse.json({ error: 'This academy is not on your account.' }, { status: 403 });

  if (action === 'save-skill') {
    const saved = await saveSkillMap(user.uid, institutionId, body, platform);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'save-opportunity') {
    const saved = await saveOpportunity(user.uid, platform ? '' : institutionId, body);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'review-opening') {
    const saved = await reviewOpening(institutionId, typeof body.openingId === 'string' ? body.openingId : '', body.publish !== false);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'revoke-endorsement') {
    const saved = await revokeSchoolEndorsement(institutionId, typeof body.studentId === 'string' ? body.studentId : '', typeof body.id === 'string' ? body.id : '');
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'set-giving') return NextResponse.json(await setGiving(institutionId, body.enabled === true));
  if (action === 'save-campaign') {
    const saved = await saveCampaign(institutionId, body);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'save-reunion') {
    const saved = await saveReunion(institutionId, body);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'reopen-wall') {
    const saved = await reopenWall(institutionId, typeof body.reunionId === 'string' ? body.reunionId : '');
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  if (action === 'review-talk') {
    const saved = await reviewTalkRequest(institutionId, typeof body.talkId === 'string' ? body.talkId : '', body.approve !== false);
    return NextResponse.json(saved, { status: 'error' in saved ? 400 : 200 });
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}
