import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import {
  createComment, createPost, createSpace, feed, follow, listSpaces, markBestAnswer,
  readParentControls, react, reportContent, screenText, searchCommunity, setDateOfBirth, writeParentControls,
} from '@/lib/server/scope-c';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'dob') return setDateOfBirth(user.uid, str(body.studentId), str(body.dateOfBirth));
    if (action === 'moderate') return screenText(user.uid, str(body.text));
    if (action === 'spaces') return createSpace(user.uid, {
      title: str(body.title), kind: str(body.kind), ageTier: str(body.ageTier),
      subject: str(body.subject), classId: str(body.classId),
      memberIds: Array.isArray(body.memberIds) ? body.memberIds.filter((id): id is string => typeof id === 'string') : [],
    });
    if (action === 'post') return createPost(user.uid, { spaceId: str(body.spaceId), kind: str(body.kind), body: str(body.body) });
    if (action === 'comment') return createComment(user.uid, { postId: str(body.postId), body: str(body.body) });
    if (action === 'react') return react(user.uid, str(body.postId), str(body.emoji));
    if (action === 'follow') return follow(user.uid, str(body.targetId));
    if (action === 'report') return reportContent(user.uid, { targetType: str(body.targetType), targetId: str(body.targetId), reason: str(body.reason) });
    if (action === 'alumni-post' || action === 'yearbook') {
      const { publishScreened } = await import('@/lib/server/et-moderation');
      const { loadMember } = await import('@/lib/server/scope-c');
      const person = await loadMember(user.uid);
      return publishScreened({
        collection: action === 'alumni-post' ? 'alumni_wall_posts' : 'yearbook_notes',
        surface: action === 'alumni-post' ? 'alumni_wall' : 'yearbook',
        authorId: user.uid,
        authorName: person.name,
        ageTier: person.ageTier,
        text: str(body.body),
        subjectPath: '',
        institutionId: str(body.institutionId),
      });
    }
    if (action === 'best-answer') return markBestAnswer(user.uid, str(body.postId), str(body.commentId));
    if (action === 'parent-controls') return writeParentControls(user.uid, str(body.studentId), body);
    const { ActionError } = await import('@/lib/server/actions');
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'spaces') return listSpaces(user.uid);
    if (action === 'feed') return feed(user.uid, req.nextUrl.searchParams.get('spaceId') ?? '');
    if (action === 'search') return searchCommunity(user.uid, req.nextUrl.searchParams.get('q') ?? '');
    if (action === 'parent-controls') return readParentControls(user.uid, req.nextUrl.searchParams.get('studentId') ?? user.uid);
    const { ActionError } = await import('@/lib/server/actions');
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
