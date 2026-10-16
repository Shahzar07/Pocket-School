import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';

export const runtime = 'nodejs';

/** Dictionary lookup for a highlighted word. No model call. */
export async function GET(request: NextRequest) {
  const denied = await enforceAiAccess(request);
  if (denied) return denied;
  const word = new URL(request.url).searchParams.get('word')?.trim().toLowerCase() ?? '';
  if (!/^[a-z][a-z'-]{0,40}$/.test(word)) {
    return NextResponse.json({ definition: '' }, { status: 400 });
  }
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return NextResponse.json({ definition: '' });
    const data = await res.json() as { meanings?: { definitions?: { definition?: string }[] }[] }[];
    const definition = data[0]?.meanings?.[0]?.definitions?.[0]?.definition ?? '';
    return NextResponse.json({ definition });
  } catch {
    return NextResponse.json({ definition: '' }, { status: 502 });
  }
}
