import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { ALLOCATION_KEY_MESSAGE } from '@/lib/admin/allocations';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { createSeatAllocation, listSeatAllocations } from '@/lib/server/seat-allocations';
import { allocationScope, canAllocate, canCreateAllocation, loadToolActor } from '@/lib/server/tool-actor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ allocations: [], comingSoon: true, error: ALLOCATION_KEY_MESSAGE });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const actor = await loadToolActor(user);
  if (!canAllocate(actor)) {
    return NextResponse.json({ error: 'Allocations are hidden for this login.' }, { status: 403 });
  }
  const allocations = await listSeatAllocations(allocationScope(actor));
  return NextResponse.json({ allocations, canCreate: canCreateAllocation(actor), scope: allocationScope(actor) });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, comingSoon: true, error: ALLOCATION_KEY_MESSAGE }, { status: 503 });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const actor = await loadToolActor(user);
  if (!canCreateAllocation(actor)) {
    return NextResponse.json({ error: 'This login can read allocations. A super admin or institution admin creates them.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (actor.staff !== 'super_admin') body.institutionId = actor.institutionId;
  if (body.targetType === 'institution' && actor.staff !== 'super_admin') body.targetId = actor.institutionId;
  try {
    const allocation = await createSeatAllocation(body, actor.uid);
    return NextResponse.json({ ok: true, allocation });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save that allocation.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
