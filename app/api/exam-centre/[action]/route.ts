import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { createPaper, listPapers, readGuidance, saveGuidance, startMock, submitMock } from '@/lib/server/scope-c';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'papers') return createPaper(user.uid, body);
    if (action === 'start') return startMock(user.uid, str(body.paperId));
    if (action === 'submit') {
      const answers: Record<string, string> = {};
      if (body.answers && typeof body.answers === 'object') {
        for (const [key, value] of Object.entries(body.answers as Record<string, unknown>)) {
          if (typeof value === 'string') answers[key] = value;
        }
      }
      return submitMock(user.uid, str(body.attemptId), answers);
    }
    if (action === 'guidance') {
      const grades: Record<string, string> = {};
      if (body.predictedGrades && typeof body.predictedGrades === 'object') {
        for (const [key, value] of Object.entries(body.predictedGrades as Record<string, unknown>)) {
          if (typeof value === 'string') grades[key] = value;
        }
      }
      return saveGuidance(user.uid, {
        interests: Array.isArray(body.interests) ? body.interests.filter((s): s is string => typeof s === 'string') : [],
        predictedGrades: grades,
      });
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'papers') return listPapers(req.nextUrl.searchParams.get('board') ?? '');
    if (action === 'guidance') return readGuidance(user.uid);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
