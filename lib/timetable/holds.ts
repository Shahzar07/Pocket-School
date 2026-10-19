import { dateFor } from './publish';
import type { TimetableDoc, Weekday } from './types';

/** A Google room booking blocks that room for the matching period of the anchor week. */
export function roomHeld(doc: TimetableDoc, roomId: string, day: Weekday, periodId: string): boolean {
  const holds = doc.roomHolds ?? [];
  if (holds.length === 0) return false;
  const date = dateFor(doc.anchorMonday, day);
  return holds.some(hold => hold.roomId === roomId && hold.day === day && hold.periodId === periodId && hold.date === date);
}
