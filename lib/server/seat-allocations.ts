import { FieldValue } from 'firebase-admin/firestore';
import { parseSeatAllocation, type SeatAllocationInput } from '@/lib/admin/allocations';
import { adminDb } from '@/lib/firebase-admin';

export interface SeatAllocationRow extends SeatAllocationInput {
  id: string;
  status: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function listSeatAllocations(institutionId: string | null): Promise<SeatAllocationRow[]> {
  const query = institutionId
    ? adminDb().collection('seat_allocations').where('institutionId', '==', institutionId).limit(100)
    : adminDb().collection('seat_allocations').limit(100);
  const snap = await query.get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    const kind = data.kind === 'plan' ? 'plan' as const : 'course' as const;
    const targetType = data.targetType === 'class' || data.targetType === 'user' ? data.targetType : 'institution' as const;
    return {
      id: doc.id,
      kind,
      courseId: text(data.courseId),
      plan: text(data.plan),
      targetType,
      targetId: text(data.targetId),
      targetLabel: text(data.targetLabel),
      seats: typeof data.seats === 'number' ? data.seats : 0,
      startsOn: text(data.startsOn),
      endsOn: text(data.endsOn),
      institutionId: text(data.institutionId),
      status: text(data.status) || 'active',
    };
  }).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

export async function createSeatAllocation(body: Record<string, unknown>, actorId: string): Promise<SeatAllocationRow> {
  const parsed = parseSeatAllocation(body);
  if (!parsed.ok) throw new Error(parsed.error);
  const ref = adminDb().collection('seat_allocations').doc();
  const row = parsed.value;
  await ref.set({
    ...row,
    status: 'active',
    createdBy: actorId,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ...row, id: ref.id, status: 'active' };
}
