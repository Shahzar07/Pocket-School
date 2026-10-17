import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, requireUser } from '@/lib/api-guard';
import {
  applyProgressWorkflow,
  listProgressAlerts,
  viewerFromProfile,
  type ProgressViewer,
} from '@/lib/alerts/progress-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCOPES = ['student', 'child', 'class', 'institution', 'platform'] as const;
type Scope = (typeof SCOPES)[number];

async function viewerFor(req: NextRequest): Promise<ProgressViewer | NextResponse> {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const platformAdmin = await callerIsAdmin(user.uid, user.email, user);
  return viewerFromProfile(user.uid, user.email || '', platformAdmin);
}

function allowed(viewer: ProgressViewer, scope: Scope): boolean {
  if (viewer.platformAdmin) return true;
  if (scope === 'student') return viewer.role === 'student';
  if (scope === 'child') return viewer.role === 'parent';
  if (scope === 'class') return viewer.role === 'teacher' || viewer.role === 'institution_admin';
  if (scope === 'institution') return viewer.role === 'institution_admin';
  return false;
}

export async function GET(req: NextRequest) {
  const viewer = await viewerFor(req);
  if (isNextResponse(viewer)) return viewer;
  const requested = req.nextUrl.searchParams.get('scope') ?? '';
  if (!(SCOPES as readonly string[]).includes(requested)) {
    return NextResponse.json({ error: 'Choose a progress view.', code: 'BAD_SCOPE' }, { status: 400 });
  }
  const scope = requested as Scope;
  if (!allowed(viewer, scope)) {
    return NextResponse.json({ error: 'You cannot open this progress view.', code: 'FORBIDDEN' }, { status: 403 });
  }
  const childId = req.nextUrl.searchParams.get('childId') ?? undefined;
  const list = await listProgressAlerts(viewer, scope, childId);
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const viewer = await viewerFor(req);
  if (isNextResponse(viewer)) return viewer;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const action = body && typeof body.action === 'string' ? body.action : '';
  const id = body && typeof body.id === 'string' ? body.id.trim() : '';
  const actions = ['acknowledge', 'assign', 'note', 'resolve', 'act', 'seen', 'parent_act', 'delegate', 'check_in', 'meeting'];
  if (!actions.includes(action)) {
    return NextResponse.json({ error: 'Choose an action from the list.', code: 'BAD_ACTION' }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: 'Progress alert not found.', code: 'NOT_FOUND' }, { status: 404 });
  try {
    const alert = await applyProgressWorkflow({
      id,
      action: action as 'acknowledge' | 'assign' | 'note' | 'resolve' | 'act' | 'seen' | 'parent_act' | 'delegate' | 'check_in' | 'meeting',
      viewer,
      assigneeId: typeof body?.assigneeId === 'string' ? body.assigneeId : undefined,
      note: typeof body?.note === 'string' ? body.note : undefined,
      checklist: typeof body?.checklist === 'string' ? body.checklist : undefined,
      meetingUrl: typeof body?.meetingUrl === 'string' ? body.meetingUrl : undefined,
      meetingAt: typeof body?.meetingAt === 'number' ? body.meetingAt : undefined,
    });
    return NextResponse.json({ alert });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Progress alert was not updated.';
    const status = message === 'Progress alert not found' ? 404 : message.startsWith('You cannot') ? 403 : 400;
    return NextResponse.json({ error: message, code: status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST' }, { status });
  }
}
