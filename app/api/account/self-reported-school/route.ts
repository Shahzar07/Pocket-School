import { NextRequest } from 'next/server';
import { recordSelfReportedSchool } from '@/lib/server/school-leads';
import { runPost } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Store a typed school name. It does not create an institution membership. */
export async function POST(req: NextRequest) {
  return runPost(req, async (user, body) => {
    const school = await recordSelfReportedSchool(user.uid, {
      name: typeof body.name === 'string' ? body.name : '',
      country: typeof body.country === 'string' ? body.country : '',
      state: typeof body.state === 'string' ? body.state : '',
    });
    return school;
  });
}
