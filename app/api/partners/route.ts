import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { isSuperAdmin } from '@/lib/roles';
import {
  adminQueue,
  applyPartner,
  createOffer,
  decideOffer,
  decidePartner,
  partnerDesk,
} from '@/lib/student-id/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function ready(): void {
  if (!isAdminConfigured()) throw new ActionError('INVALID', 'The partner desk is coming soon.');
}

async function assertAdmin(uid: string, email?: string, claimRole?: string): Promise<void> {
  if (isSuperAdmin({ role: claimRole, email })) return;
  const snap = await adminDb().doc(`users/${uid}`).get();
  const role = typeof snap.data()?.role === 'string' ? snap.data()?.role as string : '';
  if (!isSuperAdmin({ role, email })) throw new ActionError('FORBIDDEN', 'Admin access required.');
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'The partner desk is coming soon.', code: 'ADMIN_NOT_CONFIGURED' }, { status: 503 });
  }
  return runGet(req, async (user) => {
    if (req.nextUrl.searchParams.get('queue') === '1') {
      await assertAdmin(user.uid, user.email, user.role);
      return adminQueue();
    }
    return partnerDesk(user.uid);
  });
}

export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    ready();
    const action = typeof body.action === 'string' ? body.action : 'apply';
    if (action === 'apply') {
      const id = await applyPartner(user.uid, {
        name: typeof body.name === 'string' ? body.name : '',
        logo: typeof body.logo === 'string' ? body.logo : '',
        categories: list(body.categories),
        countries: list(body.countries),
        contact: typeof body.contact === 'string' ? body.contact : '',
      });
      return { id, status: 'pending' };
    }
    if (action === 'offer') {
      const id = await createOffer(user.uid, {
        title: typeof body.title === 'string' ? body.title : '',
        discount: typeof body.discount === 'string' ? body.discount : '',
        terms: typeof body.terms === 'string' ? body.terms : '',
        codeType: typeof body.codeType === 'string' ? body.codeType : 'scan',
        ageMin: typeof body.ageMin === 'number' ? body.ageMin : 0,
        countries: list(body.countries),
        cities: list(body.cities),
        startsAt: typeof body.startsAt === 'number' ? body.startsAt : Date.now(),
        endsAt: typeof body.endsAt === 'number' ? body.endsAt : Date.now() + 30 * 24 * 60 * 60 * 1000,
        category: typeof body.category === 'string' ? body.category : 'study',
        staticCode: typeof body.staticCode === 'string' ? body.staticCode : '',
      });
      return { id, status: 'review' };
    }
    if (action === 'approve-partner' || action === 'reject-partner' || action === 'approve-offer' || action === 'reject-offer') {
      await assertAdmin(user.uid, user.email, user.role);
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) throw new ActionError('VALIDATION', 'Choose a record.');
      if (action.endsWith('partner')) await decidePartner(id, action === 'approve-partner');
      else await decideOffer(id, action === 'approve-offer');
      return { ok: true };
    }
    throw new ActionError('VALIDATION', 'Unknown partner action.');
  });
}
