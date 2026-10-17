import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requirePlatformAdmin } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { loadAutomation, logAutomation, recentAutomation, saveAutomation } from '@/lib/server/automation-store';
import { readAutomation } from '@/lib/site-automation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Automation settings need the server account.' }, { status: 503 });
  }
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  const settings = await loadAutomation();
  const feed = await recentAutomation(40);
  return NextResponse.json({ settings, feed });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Automation settings need the server account.' }, { status: 503 });
  }
  const user = await requirePlatformAdmin(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => null);
  const settings = readAutomation(body);
  const previous = await loadAutomation();
  await saveAutomation(settings, user.uid);
  const changed = Object.entries(settings.rules).filter(([id, on]) => previous.rules[id as keyof typeof previous.rules] !== on);
  if (changed.length) {
    await logAutomation({
      rule: changed[0]?.[0] ?? 'student_signup',
      outcome: 'override',
      summary: `Super admin updated automation: ${changed.map(([id, on]) => `${id} ${on ? 'on' : 'off'}`).join(', ')}.`,
      actorId: user.uid,
    });
  }
  return NextResponse.json({ settings, feed: await recentAutomation(40) });
}
