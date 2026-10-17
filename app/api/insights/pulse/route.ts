import { NextRequest } from 'next/server';
import { pulseUser } from '@/lib/server/insight-counters';
import { runPost } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Count one active day, week, and month for the signed-in person. */
export async function POST(req: NextRequest) {
  return runPost(req, async (user) => {
    await pulseUser(user.uid);
    return { ok: true };
  });
}
