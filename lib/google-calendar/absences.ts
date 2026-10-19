export interface AbsenceEvent {
  id: string;
  summary: string;
  date: string;
  calendarId: string;
}

export interface FlaggedAbsence {
  sourceId: string;
  date: string;
  title: string;
  reason: 'absent' | 'leave';
  /** Always false. Cover is approved by an admin in the timetabler. */
  applied: false;
}

export const DEFAULT_ABSENCE_KEYWORD = 'leave';

/**
 * A keyword match, or any event on the chosen absence calendar, is a flag.
 * Nothing here approves cover or changes the timetable.
 */
export function flagAbsences(events: AbsenceEvent[], options: { keyword: string; absenceCalendarId?: string }): FlaggedAbsence[] {
  const keyword = options.keyword.trim().toLowerCase();
  const flagged: FlaggedAbsence[] = [];
  for (const event of events) {
    const onCalendar = Boolean(options.absenceCalendarId) && event.calendarId === options.absenceCalendarId;
    const matches = keyword.length > 0 && event.summary.toLowerCase().includes(keyword);
    if (!onCalendar && !matches) continue;
    const leave = /leave/i.test(event.summary) || (matches && /leave/i.test(keyword));
    flagged.push({
      sourceId: `gcal-absence:${event.id}`,
      date: event.date,
      title: event.summary,
      reason: leave ? 'leave' : 'absent',
      applied: false,
    });
  }
  return flagged;
}
