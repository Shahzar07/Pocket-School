import { NextRequest } from 'next/server';
import { runPost } from '@/lib/server/http';
import { solveSnap } from '@/lib/server/scope-c';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => solveSnap(user.uid, {
    text: str(body.text),
    imageBase64: str(body.imageBase64),
    context: str(body.context),
  }));
}
