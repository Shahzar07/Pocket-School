import { NextRequest } from 'next/server';
import { handleGoogleCalendar } from '@/lib/google-calendar/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return handleGoogleCalendar(action, req);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return handleGoogleCalendar(action, req);
}
