import { readFeedByToken } from '@/lib/google-calendar/store';

export const dynamic = 'force-dynamic';

/** Public subscription. The token is the secret. No Google account is required. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const feed = await readFeedByToken(decodeURIComponent(token));
  if (!feed) return new Response('This calendar link is not active.', { status: 404 });
  return new Response(feed.ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="poket-school.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
