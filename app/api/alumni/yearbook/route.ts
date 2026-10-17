import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { blockAlumni, reportAlumni } from '@/lib/server/alumni-network-store';
import {
  acceptConnection,
  addYearbookMemory,
  alumniFeed,
  alumniMap,
  commentAlumniUpdate,
  likeAlumniUpdate,
  listConnections,
  parentApproveYearbook,
  postAlumniUpdate,
  requestConnection,
  rsvpAlumniUpdate,
  saveAlumniPlace,
  saveYearbookPage,
  searchAlumni,
  signYearbook,
  submitYearbookPage,
  yearbookHome,
} from '@/lib/server/yearbook-store';

export const dynamic = 'force-dynamic';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  const bookId = req.nextUrl.searchParams.get('bookId')?.trim() ?? '';
  const home = await yearbookHome(user.uid, institutionId, bookId);
  const academyId = 'institutionId' in home ? home.institutionId : '';
  const [feed, map, connections, people] = academyId
    ? await Promise.all([
      alumniFeed(academyId),
      alumniMap(academyId),
      listConnections(user.uid),
      searchAlumni(academyId, {
        year: req.nextUrl.searchParams.get('year') ?? '',
        className: req.nextUrl.searchParams.get('className') ?? '',
        destination: req.nextUrl.searchParams.get('destination') ?? '',
        industry: req.nextUrl.searchParams.get('industry') ?? '',
        country: req.nextUrl.searchParams.get('country') ?? '',
      }),
    ])
    : [[], { countries: [], hiddenCountries: 0 }, [], []];
  return NextResponse.json({ ...home, feed, map, connections, people });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const institutionId = institutionOf(body.institutionId);
  const action = typeof body.action === 'string' ? body.action : '';
  const bookId = typeof body.bookId === 'string' ? body.bookId : '';
  const uid = user.uid;

  if (action === 'save') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const saved = await saveYearbookPage({
      uid,
      institutionId,
      bookId,
      today: todayIso(),
      quote: body.quote,
      mostLikely: body.mostLikely,
      clubs: body.clubs,
      photo: body.photo === true,
      audiences: body.audiences,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'submit') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const saved = await submitYearbookPage({ uid, institutionId, bookId, today: todayIso() });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'parent-approve') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const studentId = typeof body.studentId === 'string' ? body.studentId : '';
    const saved = await parentApproveYearbook({ parentId: uid, institutionId, bookId, studentId });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'sign') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const saved = await signYearbook({
      uid,
      institutionId,
      bookId,
      toId: typeof body.toId === 'string' ? body.toId : 'wall',
      body: body.body,
      sticker: body.sticker,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'memory') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const saved = await addYearbookMemory({ uid, institutionId, bookId, title: body.title, body: body.body });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'feed') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const saved = await postAlumniUpdate({ uid, institutionId, kind: body.kind, title: body.title, body: body.body });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'like') {
    const saved = await likeAlumniUpdate(uid, typeof body.feedId === 'string' ? body.feedId : '');
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'comment') {
    const saved = await commentAlumniUpdate({ uid, feedId: typeof body.feedId === 'string' ? body.feedId : '', body: body.body });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'rsvp') {
    const saved = await rsvpAlumniUpdate(uid, typeof body.feedId === 'string' ? body.feedId : '', body.going !== false);
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'place') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const saved = await saveAlumniPlace({
      uid,
      institutionId,
      country: body.country,
      shareName: body.shareName === true,
      directory: body.directory === true,
      industry: body.industry,
      destination: body.destination,
      year: body.year,
      className: body.className,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'connect') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const saved = await requestConnection({ uid, institutionId, otherId: typeof body.otherId === 'string' ? body.otherId : '' });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'accept') {
    const saved = await acceptConnection(uid, typeof body.otherId === 'string' ? body.otherId : '');
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'report') {
    if (!institutionId) return NextResponse.json({ error: 'Choose an academy.' }, { status: 400 });
    const saved = await reportAlumni({ uid, institutionId, targetId: body.targetId, postId: body.postId, reason: body.reason });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  if (action === 'block') {
    const saved = await blockAlumni(uid, typeof body.otherId === 'string' ? body.otherId : '');
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json(saved);
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}
