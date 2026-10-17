import { NextRequest } from 'next/server';
import { ensureStudentNumber } from '@/lib/server/student-pass';
import { runPost } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Issue PS-XXXX-XXXX on signup, or the same code again when a profile loads without one. */
export async function POST(req: NextRequest) {
  return runPost(req, async (user) => {
    const studentNumber = await ensureStudentNumber(user.uid);
    return { studentNumber };
  });
}
