import { NextResponse } from 'next/server';
import { capabilityNotices, providerStatus } from '@/lib/speech/capabilities';

/** Which speech and model keys are configured. Never returns the key values. */
export async function GET() {
  const status = providerStatus(process.env);
  return NextResponse.json({ ...status, notices: capabilityNotices(status) });
}
