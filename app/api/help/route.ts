import { NextResponse } from 'next/server';
import { listHelpArticles } from '@/lib/help-articles';

export const dynamic = 'force-dynamic';

export async function GET() {
  const articles = await listHelpArticles(true);
  return NextResponse.json({ articles });
}
