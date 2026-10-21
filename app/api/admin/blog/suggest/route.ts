import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { localSeoSuggestion } from '@/lib/blog/seo';
import { isOpenRouterConfigured, callOpenRouter, FAST_MODEL } from '@/lib/openrouter';
import { loadToolActor } from '@/lib/server/tool-actor';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { title?: unknown; excerpt?: unknown; body?: unknown };
  const title = typeof body.title === 'string' ? body.title : '';
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt : '';
  const essay = typeof body.body === 'string' ? body.body.slice(0, 6000) : '';
  const local = localSeoSuggestion({ title, excerpt, body: essay });

  if (isAdminConfigured()) {
    const user = await requireUser(req);
    if (isNextResponse(user)) return user;
    const actor = await loadToolActor(user);
    if (actor.staff !== 'super_admin') {
      return NextResponse.json({ error: 'Only a super admin can ask for essay suggestions.' }, { status: 403 });
    }
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ source: 'local', ...local });
  }

  try {
    const raw = await callOpenRouter([
      {
        role: 'system',
        content: 'You help a Poket School editor. Return JSON with seoTitle, seoDescription, and tldr, plus takeaways as an array of up to three strings. Use only the essay text. Do not invent numbers, percentages, study results, or claims that are not in the essay. Do not name other learning products.',
      },
      { role: 'user', content: `Title: ${title}\n\n${essay}` },
    ], { model: FAST_MODEL, jsonMode: true, maxTokens: 500 });
    const parsed = JSON.parse(raw) as { seoTitle?: unknown; seoDescription?: unknown; tldr?: unknown; takeaways?: unknown };
    const takeaways = Array.isArray(parsed.takeaways)
      ? parsed.takeaways.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 3)
      : local.takeaways;
    return NextResponse.json({
      source: 'openrouter',
      seoTitle: typeof parsed.seoTitle === 'string' && parsed.seoTitle.trim() ? parsed.seoTitle.trim().slice(0, 60) : local.seoTitle,
      seoDescription: typeof parsed.seoDescription === 'string' && parsed.seoDescription.trim() ? parsed.seoDescription.trim().slice(0, 160) : local.seoDescription,
      tldr: typeof parsed.tldr === 'string' && parsed.tldr.trim() ? parsed.tldr.trim().slice(0, 400) : local.tldr,
      takeaways,
    });
  } catch (error) {
    console.error('[blog] suggest', error instanceof Error ? error.message : 'failed');
    return NextResponse.json({ source: 'local', ...local });
  }
}
