/** Open times a verified tutor offers. Bookings must use one of these when any exist. */

export interface TutorSlot {
  startAtMs: number;
  minutes: number;
}

export function normaliseSlots(value: unknown, now = Date.now()): TutorSlot[] {
  if (!Array.isArray(value)) return [];
  const slots: TutorSlot[] = [];
  for (const item of value.slice(0, 14)) {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const startAtMs = typeof row.startAtMs === 'number' ? row.startAtMs : Number(row.startAtMs);
    const minutes = typeof row.minutes === 'number' ? row.minutes : Number(row.minutes);
    if (!Number.isFinite(startAtMs) || startAtMs < now - 60_000) continue;
    const length = Number.isFinite(minutes) ? Math.max(15, Math.min(180, Math.round(minutes))) : 60;
    slots.push({ startAtMs: Math.round(startAtMs), minutes: length });
  }
  const seen = new Set<number>();
  return slots.filter((slot) => {
    if (seen.has(slot.startAtMs)) return false;
    seen.add(slot.startAtMs);
    return true;
  });
}

/** No published slots means any future time is still bookable. */
export function bookingFitsSlot(slots: readonly TutorSlot[], startAtMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(startAtMs) || startAtMs < now - 60_000) return false;
  if (slots.length === 0) return true;
  return slots.some((slot) => slot.startAtMs === startAtMs);
}
