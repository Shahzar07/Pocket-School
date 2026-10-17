import { NextRequest, NextResponse } from 'next/server';
import { callerIsAdmin, isNextResponse, loadUser, requireUser } from '@/lib/api-guard';
import { adminDb, isAdminConfigured } from '@/lib/firebase-admin';
import { programmeRevenue, type RevenueInput } from '@/lib/institution-catalogue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) return NextResponse.json({ rows: [] });
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const asked = req.nextUrl.searchParams.get('institutionId')?.trim() ?? '';
  const admin = await callerIsAdmin(user.uid, user.email, user);
  const profile = await loadUser(user.uid);
  const own = typeof profile?.institutionId === 'string' ? profile.institutionId : '';
  if (!admin && (!own || (asked && asked !== own))) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }
  const institutionId = admin ? asked : own;
  const docs = institutionId
    ? [await adminDb().doc(`institutions/${institutionId}`).get()].filter((doc) => doc.exists)
    : (await adminDb().collection('institutions').limit(80).get()).docs;
  const rows: RevenueInput[] = [];
  for (const doc of docs) {
    const bill = await adminDb().doc(`institutions/${doc.id}/billing/current`).get();
    const data = bill.data() ?? {};
    const currency = typeof data.currency === 'string' ? data.currency : 'USD';
    const stored = Array.isArray(data.lines) ? data.lines : [];
    const lines = stored.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const line = row as { id?: unknown; title?: unknown; amount?: unknown };
      const id = typeof line.id === 'string' ? line.id : '';
      if (!id) return [];
      return [{ id, title: typeof line.title === 'string' ? line.title : id, amount: typeof line.amount === 'number' ? line.amount : 0 }];
    });
    if (lines.length === 0 && typeof data.total === 'number' && Array.isArray(data.programmeIds)) {
      const ids = data.programmeIds.filter((id: unknown): id is string => typeof id === 'string');
      const share = ids.length ? data.total / ids.length : 0;
      ids.forEach((id) => lines.push({ id, title: id, amount: share }));
    }
    rows.push({
      institutionId: doc.id,
      name: typeof doc.get('name') === 'string' ? doc.get('name') as string : doc.id,
      currency,
      lines,
    });
  }
  return NextResponse.json({ rows: programmeRevenue(rows) });
}
