import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { bannerHref } from '@/lib/safety/banner';
import { loadSafeLineBanner } from '@/lib/server/safeline-banner';
import { loadToolActor } from '@/lib/server/tool-actor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ show: false, count: 0, oldestLabel: '', href: '', comingSoon: true });
  }
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const actor = await loadToolActor(user);
  if (!bannerHref(actor)) return NextResponse.json({ show: false, count: 0, oldestLabel: '', href: '' });
  const snapshot = await loadSafeLineBanner(actor);
  return NextResponse.json(snapshot);
}
