export const ALLOCATION_KINDS = ['course', 'plan'] as const;
export const ALLOCATION_TARGETS = ['institution', 'class', 'user'] as const;

export type AllocationKind = (typeof ALLOCATION_KINDS)[number];
export type AllocationTarget = (typeof ALLOCATION_TARGETS)[number];

export interface SeatAllocationInput {
  kind: AllocationKind;
  courseId: string;
  plan: string;
  targetType: AllocationTarget;
  targetId: string;
  targetLabel: string;
  seats: number;
  startsOn: string;
  endsOn: string;
  institutionId: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function parseSeatAllocation(body: Record<string, unknown>): { ok: true; value: SeatAllocationInput } | { ok: false; error: string } {
  const kind = body.kind === 'plan' ? 'plan' : body.kind === 'course' ? 'course' : '';
  if (!kind) return { ok: false, error: 'Choose a course or a plan.' };
  const targetType = body.targetType === 'class' || body.targetType === 'user' || body.targetType === 'institution'
    ? body.targetType
    : '';
  if (!targetType) return { ok: false, error: 'Choose an institution, a class, or a user.' };
  const targetId = text(body.targetId, 120);
  const targetLabel = text(body.targetLabel, 160);
  if (targetId.length < 2 || targetLabel.length < 2) return { ok: false, error: 'Name who receives the seats.' };
  const seats = typeof body.seats === 'number' ? body.seats : Number(body.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 100000) return { ok: false, error: 'Seats must be a whole number from 1 to 100000.' };
  const startsOn = text(body.startsOn, 10);
  const endsOn = text(body.endsOn, 10);
  if (!DAY.test(startsOn) || !DAY.test(endsOn) || endsOn < startsOn) return { ok: false, error: 'Choose a start date and an end date.' };
  const courseId = text(body.courseId, 120);
  const plan = text(body.plan, 40);
  if (kind === 'course' && courseId.length < 2) return { ok: false, error: 'Choose the course.' };
  if (kind === 'plan' && plan.length < 2) return { ok: false, error: 'Choose the plan.' };
  return {
    ok: true,
    value: {
      kind,
      courseId: kind === 'course' ? courseId : '',
      plan: kind === 'plan' ? plan : '',
      targetType,
      targetId,
      targetLabel,
      seats,
      startsOn,
      endsOn,
      institutionId: text(body.institutionId, 120),
    },
  };
}

export const ALLOCATION_KEY_MESSAGE = 'The allocation list needs the Firebase Admin key. This admin tool is coming soon.';
