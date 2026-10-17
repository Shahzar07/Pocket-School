import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { deviceFromHeaders } from '@/lib/ledger/device';
import {
  allStaffBanner,
  allStaffRollCall,
  checkInAllStaff,
  clearAllStaff,
  readAllStaffInstructions,
  saveAllStaffInstructions,
  widenAllStaff,
} from '@/lib/server/all-staff';

export const dynamic = 'force-dynamic';

function withDevice(req: NextRequest, body: Record<string, unknown>) {
  return { ...body, device: deviceFromHeaders(req.headers) };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'widen') return runPost(req, (user, body) => widenAllStaff(user.uid, withDevice(req, body)));
  if (action === 'check-in') return runPost(req, (user, body) => checkInAllStaff(user.uid, body));
  if (action === 'clear') return runPost(req, (user, body) => clearAllStaff(user.uid, withDevice(req, body)));
  if (action === 'instructions') return runPost(req, (user, body) => saveAllStaffInstructions(user.uid, body));
  return runPost(req, async () => ({ error: 'Unknown action.' }));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === 'banner') return runGet(req, user => allStaffBanner(user.uid));
  if (action === 'roll-call') {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    return runGet(req, user => allStaffRollCall(user.uid, id));
  }
  if (action === 'instructions') return runGet(req, user => readAllStaffInstructions(user.uid));
  return runGet(req, async () => ({ error: 'Unknown action.' }));
}
