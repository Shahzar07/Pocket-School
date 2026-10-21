import { errorResponse, requireUser } from '@/lib/server-auth';
import { publishedPack } from '@/lib/study/pack-server';

export async function GET(req: Request, context: { params: Promise<{ packId: string }> }) {
  try {
    await requireUser(req);
    const { packId } = await context.params;
    const pack = await publishedPack(packId);
    if (!pack) return Response.json({ error: 'Unknown exam pack.' }, { status: 404 });
    return Response.json({ pack });
  } catch (err) {
    return errorResponse(err, 'Could not load this exam pack.');
  }
}
