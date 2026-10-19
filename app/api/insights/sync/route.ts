import { NextRequest } from 'next/server';
import { reconcileUser } from '@/lib/server/insight-counters';
import { parseGender } from '@/lib/insights/census';
import { runPost } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Save demographic fields and move the pre-aggregated counters. */
export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    const gender = parseGender(body.gender);
    if (body.gender && !gender) {
      const { ActionError } = await import('@/lib/server/actions');
      throw new ActionError('VALIDATION', 'Choose male or female.');
    }
    const statistics = body.demographicConsent === true;
    await reconcileUser(user.uid, {
      gender: statistics ? gender : '',
      country: typeof body.country === 'string' ? body.country : '',
      region: typeof body.region === 'string' ? body.region : '',
      level: typeof body.level === 'string' ? body.level : '',
      yearGroup: typeof body.yearGroup === 'string' ? body.yearGroup : '',
      institutionName: typeof body.institutionName === 'string' ? body.institutionName : '',
      dateOfBirth: typeof body.dateOfBirth === 'string' ? body.dateOfBirth : '',
      demographicConsent: body.demographicConsent === true,
      pendingChild: body.pendingChild && typeof body.pendingChild === 'object' ? body.pendingChild : undefined,
    }, req.headers);
    return { ok: true };
  });
}
