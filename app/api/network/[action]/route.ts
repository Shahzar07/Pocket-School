import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import {
  applyToOpening, approveOrg, commentOnPost, createNetworkPost, deleteNetwork, exportNetwork,
  feedFor, followTarget, inmail, networkInsights, postOpening, reactToPost, readProfile,
  reportOrBlock, repost, requestConnection, respondConnection, sandboxUpgrade, saveAutomation,
  saveOrg, saveProfile, saveSearch, searchCandidates, sendDirectMessage, talentList,
} from '@/lib/server/network';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'profile') return saveProfile(user.uid, body);
    if (action === 'post') return createNetworkPost(user.uid, body);
    if (action === 'comment') return commentOnPost(user.uid, str(body.postId), str(body.body));
    if (action === 'react') return reactToPost(user.uid, str(body.postId), str(body.emoji));
    if (action === 'repost') return repost(user.uid, str(body.postId));
    if (action === 'connect') return requestConnection(user.uid, str(body.targetId));
    if (action === 'connect-reply') return respondConnection(user.uid, str(body.connectionId), body.accept === true);
    if (action === 'follow') return followTarget(user.uid, str(body.targetId), str(body.orgId));
    if (action === 'message') return sendDirectMessage(user.uid, str(body.targetId), str(body.body));
    if (action === 'report') return reportOrBlock(user.uid, body, false);
    if (action === 'block') return reportOrBlock(user.uid, body, true);
    if (action === 'org') return saveOrg(user.uid, body);
    if (action === 'org-approve') return approveOrg(user.uid, str(body.orgId));
    if (action === 'search-save') return saveSearch(user.uid, body);
    if (action === 'talent') return talentList(user.uid, body);
    if (action === 'inmail') return inmail(user.uid, str(body.targetId), str(body.body));
    if (action === 'upgrade') return sandboxUpgrade(user.uid, str(body.tier));
    if (action === 'apply') return applyToOpening(user.uid, body);
    if (action === 'opening') return postOpening(user.uid, body);
    if (action === 'delete') return deleteNetwork(user.uid);
    if (action === 'settings') return saveAutomation(user.uid, body);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'feed') return feedFor(user.uid);
    if (action === 'profile') return readProfile(user.uid, req.nextUrl.searchParams.get('handle') ?? '');
    if (action === 'search') return searchCandidates(user.uid, {
      skills: (req.nextUrl.searchParams.get('skills') ?? '').split(',').filter(Boolean),
      level: req.nextUrl.searchParams.get('level') ?? '',
      certificates: (req.nextUrl.searchParams.get('certificates') ?? '').split(',').filter(Boolean),
      location: req.nextUrl.searchParams.get('location') ?? '',
      availability: req.nextUrl.searchParams.get('availability') ?? '',
      institutionId: req.nextUrl.searchParams.get('institutionId') ?? '',
    });
    if (action === 'export') return exportNetwork(user.uid);
    if (action === 'insights') return networkInsights(user.uid);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
