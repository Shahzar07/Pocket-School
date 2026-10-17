import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { ActionError } from '@/lib/server/actions';
import { COMING_SOON, submitPartnerApplication } from '@/lib/server/community-partners';

export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || 'unknown';
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`community-partner:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many applications. Please wait and try again.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const result = await submitPartnerApplication({
      orgName: typeof body.orgName === 'string' ? body.orgName : '',
      type: typeof body.type === 'string' ? body.type : '',
      country: typeof body.country === 'string' ? body.country : '',
      region: typeof body.region === 'string' ? body.region : '',
      contactName: typeof body.contactName === 'string' ? body.contactName : '',
      email: typeof body.email === 'string' ? body.email : '',
      phone: typeof body.phone === 'string' ? body.phone : '',
      website: typeof body.website === 'string' ? body.website : '',
      message: typeof body.message === 'string' ? body.message : '',
      companyFax: typeof body.companyFax === 'string' ? body.companyFax : '',
    });
    if (!result.ok) return NextResponse.json(result);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ comingSoon: true, message: COMING_SOON }, { status: 200 });
  }
}
