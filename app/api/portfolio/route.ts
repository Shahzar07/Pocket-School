import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, rateLimit, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { readTemplate } from '@/lib/portfolio';
import {
  deleteCvVersion,
  exportCvFile,
  listCvVersions,
  listOwnedShareLinks,
  saveCvVersion,
  savePortfolioTheme,
  translateCv,
} from '@/lib/server/cv-store';
import {
  buildPortfolio,
  deleteSelfItem,
  exportPortfolio,
  parentApprove,
  previewSummary,
  readPublicPortfolio,
  recordStatedDestination,
  saveConsent,
  saveReviewedSummary,
  saveSelfItem,
} from '@/lib/server/learner-record-store';

export const dynamic = 'force-dynamic';

function ipOf(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ preview: true, profile: null, portfolio: null });
  }
  const number = req.nextUrl.searchParams.get('number')?.trim() ?? '';
  if (number) {
    if (!rateLimit(`portfolio:${ipOf(req)}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
    }
    const profile = await readPublicPortfolio(number);
    return NextResponse.json({ profile });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const [portfolio, versions, links] = await Promise.all([
    buildPortfolio(user.uid),
    listCvVersions(user.uid),
    listOwnedShareLinks(user.uid),
  ]);
  return NextResponse.json({ portfolio, versions, links });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Server is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'save-item') {
    const kind = typeof body.kind === 'string' ? body.kind : '';
    const saved = await saveSelfItem(user.uid, {
      id: typeof body.id === 'string' ? body.id : undefined,
      kind,
      title: typeof body.title === 'string' ? body.title : '',
      detail: typeof body.detail === 'string' ? body.detail : '',
      when: typeof body.when === 'string' ? body.when : '',
      evidenceLink: typeof body.evidenceLink === 'string' ? body.evidenceLink : '',
      evidencePath: typeof body.evidencePath === 'string' ? body.evidencePath : '',
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json({ item: saved });
  }
  if (action === 'delete-item') {
    const removed = await deleteSelfItem(user.uid, typeof body.id === 'string' ? body.id : '');
    if ('error' in removed) return NextResponse.json(removed, { status: 400 });
    return NextResponse.json(removed);
  }
  if (action === 'consent') {
    const sections = body.sections && typeof body.sections === 'object' ? body.sections as Record<string, unknown> : undefined;
    const consent = await saveConsent(user.uid, {
      publicPortfolio: typeof body.publicPortfolio === 'boolean' ? body.publicPortfolio : undefined,
      sharePortfolioWithSchools: typeof body.sharePortfolioWithSchools === 'boolean' ? body.sharePortfolioWithSchools : undefined,
      shareDestinationWithSchools: typeof body.shareDestinationWithSchools === 'boolean' ? body.shareDestinationWithSchools : undefined,
      includeScores: typeof body.includeScores === 'boolean' ? body.includeScores : undefined,
      template: typeof body.template === 'string' ? body.template : undefined,
      sections,
    });
    const portfolio = await buildPortfolio(user.uid);
    return NextResponse.json({ consent, portfolio });
  }
  if (action === 'summary') {
    return NextResponse.json(await previewSummary(user.uid));
  }
  if (action === 'save-summary') {
    const saved = await saveReviewedSummary(user.uid);
    return NextResponse.json(saved);
  }
  if (action === 'destination') {
    const saved = await recordStatedDestination(user.uid, {
      kind: typeof body.kind === 'string' ? body.kind : 'other',
      name: typeof body.name === 'string' ? body.name : '',
      course: typeof body.course === 'string' ? body.course : '',
      country: typeof body.country === 'string' ? body.country : '',
      shareWithSchools: body.shareWithSchools === true,
      shareName: body.shareName === true,
      testimonial: typeof body.testimonial === 'string' ? body.testimonial : '',
      shareTestimonial: body.shareTestimonial === true,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json({ destination: saved });
  }
  if (action === 'export') {
    const format = body.format === 'json' || body.format === 'linkedin' || body.format === 'cv' ? body.format : 'cv';
    const file = await exportPortfolio(user.uid, format, readTemplate(body.template));
    return NextResponse.json(file);
  }
  if (action === 'save-version') {
    const saved = await saveCvVersion(user.uid, {
      id: body.id,
      name: body.name,
      shareToken: body.shareToken,
      design: body.design,
    });
    if ('error' in saved) return NextResponse.json(saved, { status: 400 });
    return NextResponse.json({ version: saved, versions: await listCvVersions(user.uid) });
  }
  if (action === 'delete-version') {
    const removed = await deleteCvVersion(user.uid, body.id);
    if ('error' in removed) return NextResponse.json(removed, { status: 400 });
    return NextResponse.json({ ...removed, versions: await listCvVersions(user.uid) });
  }
  if (action === 'save-theme') {
    const theme = await savePortfolioTheme(user.uid, body.design);
    return NextResponse.json({ theme });
  }
  if (action === 'translate-cv') {
    const translated = await translateCv(user.uid, { id: body.id, design: body.design });
    if ('error' in translated) return NextResponse.json(translated, { status: 400 });
    return NextResponse.json(translated);
  }
  if (action === 'export-cv') {
    const file = await exportCvFile(user.uid, { format: body.format, id: body.id, design: body.design });
    if ('error' in file) return NextResponse.json(file, { status: 400 });
    return NextResponse.json(file);
  }
  if (action === 'parent-approve') {
    const studentId = typeof body.studentId === 'string' ? body.studentId : '';
    const result = await parentApprove(user.uid, studentId);
    if ('error' in result) return NextResponse.json(result, { status: 403 });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: 'Choose a step.' }, { status: 400 });
}
