import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser, type AuthedUser } from '../api-guard';
import { ActionError } from './actions';

function statusFor(code: string): number {
  if (code === 'FORBIDDEN') return 403;
  if (code === 'NOT_FOUND' || code === 'USER_NOT_FOUND') return 404;
  if (code === 'INSUFFICIENT_SPARKS' || code === 'INSUFFICIENT_WALLET') return 402;
  return 400;
}

export async function runPost(
  req: NextRequest,
  fn: (user: AuthedUser, body: Record<string, unknown>) => Promise<unknown>,
): Promise<NextResponse> {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await fn(user, body);
    return NextResponse.json(data ?? { ok: true });
  } catch (error) {
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusFor(error.code) });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}

export async function runGet(
  req: NextRequest,
  fn: (user: AuthedUser) => Promise<unknown>,
): Promise<NextResponse> {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  try {
    return NextResponse.json(await fn(user));
  } catch (error) {
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusFor(error.code) });
    }
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
  }
}
