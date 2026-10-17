import { NextResponse } from 'next/server';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { loadAutomation } from '@/lib/server/automation-store';
import { defaultAutomation } from '@/lib/site-automation';

export const dynamic = 'force-dynamic';

/** Public booleans for self-serve doors. No feed and no secrets. */
export async function GET() {
  const settings = isAdminConfigured() ? await loadAutomation() : defaultAutomation();
  return NextResponse.json({ rules: settings.rules });
}
