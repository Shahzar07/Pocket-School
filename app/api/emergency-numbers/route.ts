import { NextRequest, NextResponse } from 'next/server';
import { runPost } from '@/lib/server/http';
import { emergencyNumbersFor, listEmergencyNumbers, saveEmergencyNumbers } from '@/lib/server/emergency-numbers';
import { SEEDED_EMERGENCY_NUMBERS, numbersFor } from '@/lib/emergency-numbers/catalog';

export const dynamic = 'force-dynamic';

/** Public read. The bundled seed is returned when the server database is unavailable. */
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country') ?? '';
  try {
    if (country) return NextResponse.json({ numbers: await emergencyNumbersFor(country) });
    return NextResponse.json({ numbers: await listEmergencyNumbers() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ numbers: country ? numbersFor(country) : SEEDED_EMERGENCY_NUMBERS });
  }
}

export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => saveEmergencyNumbers(user.uid, body));
}
