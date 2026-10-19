import { isAfternoon } from './solver';
import type { Period, StaffMember, Weekday } from './types';

const DAY_WORDS: Record<string, Weekday> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri',
  mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri',
};

export interface ParsedConstraint {
  staffId: string;
  staffName: string;
  slots: string[];
  summary: string;
}

export function parseNaturalConstraint(text: string, staff: StaffMember[], periods: Period[]): ParsedConstraint | { error: string } {
  const match = text.trim().match(/(.+?)\s+can(?:not|'t)\s+do\s+(monday|tuesday|wednesday|thursday|friday|mon|tue|wed|thu|fri)(?:\s+(mornings?|afternoons?|all day))?/i);
  if (!match) return { error: 'Write it as a name, then “can’t do”, then a weekday and morning or afternoon.' };
  const rawName = match[1]!.replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').trim().toLowerCase();
  const found = staff
    .map(person => ({ person, score: person.name.toLowerCase().includes(rawName) ? rawName.length : 0 }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id))[0]?.person;
  if (!found) return { error: 'ET AI could not match that name to a member of staff.' };
  const day = DAY_WORDS[match[2]!.toLowerCase()];
  if (!day) return { error: 'Name a school day.' };
  const part = (match[3] ?? 'all day').toLowerCase();
  const slots = periods.filter(period => {
    if (part.startsWith('morning')) return !isAfternoon(period);
    if (part.startsWith('afternoon')) return isAfternoon(period);
    return true;
  }).map(period => `${day}:${period.id}`);
  const when = part.startsWith('morning') ? 'mornings' : part.startsWith('afternoon') ? 'afternoons' : 'that day';
  return {
    staffId: found.id,
    staffName: found.name,
    slots,
    summary: `${found.name} can’t do ${match[2]} ${when}.`,
  };
}

export function applyParsedConstraint<T extends { staff: StaffMember[] }>(doc: T, parsed: ParsedConstraint): T {
  return {
    ...doc,
    staff: doc.staff.map(person => person.id === parsed.staffId
      ? { ...person, unavailable: [...new Set([...person.unavailable, ...parsed.slots])].sort() }
      : person),
  };
}
