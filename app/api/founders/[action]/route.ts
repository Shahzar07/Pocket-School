import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import {
  applyProgramme, applyStartup, founderMessage, saveFounder, saveProgramme, saveStartup,
  schoolTeam, suggestions, swipe, weeklyFounderDigest,
} from '@/lib/server/founders';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'profile') return saveFounder(user.uid, body);
    if (action === 'swipe') return swipe(user.uid, str(body.targetId), str(body.choice));
    if (action === 'message') return founderMessage(user.uid, str(body.targetId), str(body.body));
    if (action === 'startup') return saveStartup(user.uid, body);
    if (action === 'startup-apply') return applyStartup(user.uid, str(body.startupId), str(body.note));
    if (action === 'programme') return saveProgramme(user.uid, body);
    if (action === 'programme-apply') return applyProgramme(user.uid, str(body.programmeId), body.answers);
    if (action === 'school-team') return schoolTeam(user.uid, str(body.targetId));
    if (action === 'digest') return weeklyFounderDigest();
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'suggestions') return suggestions(user.uid);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
