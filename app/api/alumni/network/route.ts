import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import {
  blockAlumni,
  offerMentorship,
  publishClassPost,
  replyToCampaign,
  reportAlumni,
  requestMentor,
  rsvpAlumniEvent,
  saveAlumniConsent,
  sendAlumniDirect,
  sendMentorMessage,
  studentHome,
  updateAlumniDestination,
} from '@/lib/server/alumni-network-store';

export const dynamic = 'force-dynamic';

function institutionOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const institutionId = req.nextUrl.searchParams.get('institutionId')?.trim() ?? '';
  return NextResponse.json(await studentHome(user.uid, institutionId));
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const institutionId = institutionOf(body.institutionId);
  if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
  const action = typeof body.action === 'string' ? body.action : '';
  const uid = user.uid;

  if (action === 'consent') {
    const saved = await saveAlumniConsent(uid, institutionId, body.consent);
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json({ consent: saved });
  }
  if (action === 'post' || action === 'share-achievement') {
    const saved = await publishClassPost({
      uid,
      institutionId,
      groupId: typeof body.groupId === 'string' ? body.groupId : '',
      body: body.body,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'rsvp') {
    const saved = await rsvpAlumniEvent({
      uid,
      institutionId,
      eventId: typeof body.eventId === 'string' ? body.eventId : '',
      going: body.going !== false,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'report') {
    const saved = await reportAlumni({ uid, institutionId, targetId: body.targetId, postId: body.postId, reason: body.reason });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'block') {
    const saved = await blockAlumni(uid, typeof body.otherId === 'string' ? body.otherId : '');
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'dm') {
    const saved = await sendAlumniDirect({
      uid,
      institutionId,
      otherId: typeof body.otherId === 'string' ? body.otherId : '',
      body: body.body,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'mentor-request') {
    const saved = await requestMentor({ uid, institutionId, mentorId: typeof body.mentorId === 'string' ? body.mentorId : '' });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'mentor-offer') {
    const saved = await offerMentorship({ uid, institutionId, studentId: typeof body.studentId === 'string' ? body.studentId : '' });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'mentor-message') {
    const saved = await sendMentorMessage({
      uid,
      institutionId,
      mentorshipId: typeof body.mentorshipId === 'string' ? body.mentorshipId : '',
      body: body.body,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'update-destination') {
    const saved = await updateAlumniDestination({
      uid,
      institutionId,
      destination: body.destination,
      job: body.job,
      contact: body.contact,
      country: body.country,
      kind: body.kind,
      shareWithSchools: body.shareWithSchools === true,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'reply') {
    const saved = await replyToCampaign({
      uid,
      institutionId,
      campaignId: typeof body.campaignId === 'string' ? body.campaignId : '',
      body: body.body,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}
