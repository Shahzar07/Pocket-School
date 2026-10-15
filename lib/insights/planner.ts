/**
 * Year planner. Imports stay drafts until a person publishes them.
 * Holidays and closures are not absences. A date move rebuilds the pacing.
 */

import { CALENDAR_TEMPLATES, type CalendarItem } from './calendar';
import { addDays, dateKeysBetween, weekdayOf } from './dates';
import { readStoredZip } from './xlsx';

export type PlannerKind =
  | 'term' | 'semester' | 'holiday' | 'exam' | 'ptm' | 'event'
  | 'closure' | 'period' | 'assessment' | 'report' | 'revision';

export type PlannerSource = 'manual' | 'import' | 'template' | 'ai_draft';
export type PlannerVisibility = 'school' | 'personal';

export interface PlannerEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  kind: PlannerKind;
  campusId?: string;
  classId?: string;
  yearGroup?: string;
  recurrence?: 'none' | 'weekly';
  period?: string;
  source: PlannerSource;
  audience: 'all' | 'students' | 'teachers' | 'parents';
}

export interface YearPlan {
  id: string;
  institutionId: string;
  label: string;
  brand: string;
  visibility: PlannerVisibility;
  ownerId: string;
  ownerRole: 'institution' | 'teacher' | 'parent';
  campusId?: string;
  classId?: string;
  yearGroup?: string;
  subscribeToken?: string;
  events: PlannerEvent[];
}

export interface YearTemplate {
  id: string;
  label: string;
  country: 'MY' | 'GB' | 'SG' | 'UN';
  note: string;
  events: PlannerEvent[];
}

const item = (
  id: string,
  title: string,
  date: string,
  kind: PlannerKind,
  endDate?: string,
): PlannerEvent => ({
  id, title, date, endDate, kind, source: 'template', audience: 'all', recurrence: 'none',
});

function holidayEvents(templateId: string): PlannerEvent[] {
  const template = CALENDAR_TEMPLATES.find(row => row.id === templateId);
  return (template?.items ?? []).map((row, index) => item(
    `${templateId}-${index}`,
    row.title,
    row.date,
    row.type === 'exam' ? 'exam' : 'holiday',
    row.endDate,
  ));
}

export const YEAR_TEMPLATES: readonly YearTemplate[] = [
  {
    id: 'malaysia-school-2026',
    label: 'Malaysian school year',
    country: 'MY',
    note: 'A starting sketch. Confirm term dates and moving holidays against the state gazette before publishing.',
    events: [
      item('my-t1', 'Term 1', '2026-01-12', 'term', '2026-05-29'),
      item('my-t2', 'Term 2', '2026-06-15', 'term', '2026-11-20'),
      ...holidayEvents('malaysia-2026'),
    ],
  },
  {
    id: 'uk-three-term-2026',
    label: 'UK three-term year',
    country: 'GB',
    note: 'England and Wales sketch. Scotland and Northern Ireland differ. Confirm with the school.',
    events: [
      item('uk-autumn', 'Autumn term', '2026-09-07', 'term', '2026-12-18'),
      item('uk-spring', 'Spring term', '2027-01-04', 'term', '2027-03-26'),
      item('uk-summer', 'Summer term', '2027-04-19', 'term', '2027-07-16'),
      ...holidayEvents('uk-2026'),
    ],
  },
  {
    id: 'igcse-2026',
    label: 'IGCSE exam windows',
    country: 'UN',
    note: 'Windows only. Use the official paper timetable before publishing.',
    events: holidayEvents('igcse-2026'),
  },
  {
    id: 'alevel-2026',
    label: 'A-Level exam windows',
    country: 'UN',
    note: 'Windows only. Papers are not evenly spread. Confirm the board timetable.',
    events: holidayEvents('alevel-2026'),
  },
  {
    id: 'singapore-2026',
    label: 'Singapore public holidays 2026',
    country: 'SG',
    note: 'Confirm against the Ministry of Manpower gazette.',
    events: [
      item('sg-ny', 'New Year', '2026-01-01', 'holiday'),
      item('sg-nd', 'National Day', '2026-08-09', 'holiday'),
      item('sg-xmas', 'Christmas', '2026-12-25', 'holiday'),
    ],
  },
];

export function countryFromTimeZone(zone: string): 'MY' | 'GB' | 'SG' | 'UN' {
  if (zone === 'Asia/Kuala_Lumpur' || zone === 'Asia/Kuching') return 'MY';
  if (zone === 'Europe/London') return 'GB';
  if (zone === 'Asia/Singapore') return 'SG';
  return 'UN';
}

export function templateForCountry(country: 'MY' | 'GB' | 'SG' | 'UN'): YearTemplate {
  if (country === 'MY') return YEAR_TEMPLATES[0];
  if (country === 'GB') return YEAR_TEMPLATES[1];
  if (country === 'SG') return YEAR_TEMPLATES[4];
  return YEAR_TEMPLATES[2];
}

export function subscribeTarget(input: string): { provider: 'google' | 'outlook' | 'ics' | null; icsUrl: string | null } {
  const trimmed = input.trim();
  if (!trimmed) return { provider: null, icsUrl: null };
  const https = trimmed.startsWith('webcal://') ? `https://${trimmed.slice('webcal://'.length)}` : trimmed;
  if (/calendar\.google\.com/i.test(https) && /\.ics(\?|$)/i.test(https)) return { provider: 'google', icsUrl: https };
  if (/outlook\.(office365|office|live)\.com/i.test(https)) return { provider: 'outlook', icsUrl: https };
  if (/^https:\/\/.+\.ics(\?|$)/i.test(https)) return { provider: 'ics', icsUrl: https };
  return { provider: null, icsUrl: null };
}

export function parseSheetXml(xml: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = xml.match(/<row\b[\s\S]*?<\/row>/g) ?? [];
  for (const row of rowMatches) {
    const cells = [...row.matchAll(/<t>([^<]*)<\/t>/g)].map(match => match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"'));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/** Reads a spreadsheet this app wrote: title, date, type. Other files stay unparsed. */
export function parseXlsxCalendar(bytes: Uint8Array): CalendarItem[] {
  const zip = readStoredZip(bytes);
  const sheet = zip.get('xl/worksheets/sheet1.xml');
  if (!sheet) return [];
  const rows = parseSheetXml(new TextDecoder().decode(sheet));
  if (rows.length < 2) return [];
  const headers = rows[0].map(cell => cell.trim().toLowerCase());
  const titleI = headers.indexOf('title');
  const dateI = headers.indexOf('date');
  if (titleI < 0 || dateI < 0) return [];
  const typeI = headers.indexOf('type');
  const items: CalendarItem[] = [];
  for (const row of rows.slice(1)) {
    const title = row[titleI]?.trim();
    const date = row[dateI]?.trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) continue;
    if (title.startsWith('©')) continue;
    const type = (row[typeI]?.trim().toLowerCase() ?? 'event');
    items.push({
      title,
      date,
      type: type === 'holiday' || type === 'exam' || type === 'class' ? type : 'event',
      source: 'ai_draft',
    });
  }
  return items;
}

const BLOCKING: ReadonlySet<PlannerKind> = new Set(['holiday', 'closure', 'exam']);

export function coveredDates(event: PlannerEvent): string[] {
  return dateKeysBetween(event.date, event.endDate ?? event.date);
}

export function blockedDates(events: readonly PlannerEvent[]): string[] {
  const dates = new Set<string>();
  for (const event of events) {
    if (!BLOCKING.has(event.kind)) continue;
    for (const date of coveredDates(event)) dates.add(date);
  }
  return [...dates];
}

export function isSchoolDay(date: string, events: readonly PlannerEvent[]): boolean {
  const weekday = weekdayOf(date);
  if (weekday === 0 || weekday === 6) return false;
  return !blockedDates(events).includes(date);
}

/** Holidays, closures, exam weeks, and weekends are not absences. */
export function absenceCounts(date: string, events: readonly PlannerEvent[]): boolean {
  return isSchoolDay(date, events);
}

export function teachingDays(start: string, end: string, events: readonly PlannerEvent[]): string[] {
  const blocked = new Set(blockedDates(events));
  return dateKeysBetween(start, end).filter(date => {
    const weekday = weekdayOf(date);
    return weekday !== 0 && weekday !== 6 && !blocked.has(date);
  });
}

export interface PacingRow {
  unitId: string;
  unitTitle: string;
  lesson: string;
  date: string;
}

/** Spreads lessons across teaching days. A later call rebuilds the guide after a date moves. */
export function paceCurriculum(
  units: { id: string; title: string; lessons: string[] }[],
  days: readonly string[],
): PacingRow[] {
  const lessons = units.flatMap(unit => unit.lessons.map(lesson => ({
    unitId: unit.id,
    unitTitle: unit.title,
    lesson,
  })));
  if (!lessons.length || !days.length) return [];
  if (lessons.length === 1) return [{ ...lessons[0], date: days[0] }];
  const step = (days.length - 1) / (lessons.length - 1);
  return lessons.map((row, index) => ({
    ...row,
    date: days[Math.min(days.length - 1, Math.round(index * step))],
  }));
}

export function replan(
  units: { id: string; title: string; lessons: string[] }[],
  start: string,
  end: string,
  events: readonly PlannerEvent[],
): PacingRow[] {
  return paceCurriculum(units, teachingDays(start, end, events));
}

export function dripOnSchoolDays(start: string, count: number, events: readonly PlannerEvent[]): string[] {
  const dates: string[] = [];
  let cursor = start;
  let guard = 0;
  while (dates.length < count && guard < 60) {
    if (isSchoolDay(cursor, events)) dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

export function milestoneDates(termEnd: string): { assessment: string; report: string } {
  return { assessment: addDays(termEnd, -14), report: addDays(termEnd, -7) };
}

export function revisionDates(examDate: string, events: readonly PlannerEvent[], count = 3): string[] {
  const dates: string[] = [];
  let cursor = addDays(examDate, -1);
  let guard = 0;
  while (dates.length < count && guard < 40) {
    if (isSchoolDay(cursor, events)) dates.push(cursor);
    cursor = addDays(cursor, -1);
    guard += 1;
  }
  return dates.reverse();
}

export function revisionGoalDrafts(examTitle: string, examDate: string, topics: string[], events: readonly PlannerEvent[]) {
  const dates = revisionDates(examDate, events, Math.max(topics.length, 1));
  return dates.map((dateKey, index) => ({
    title: `Revise ${topics[index] ?? examTitle}`,
    dateKey,
    source: 'ai' as const,
    examTitle,
  }));
}

export function termWindow(events: readonly PlannerEvent[], date: string): { title: string; start: string; end: string } | null {
  const terms = events.filter(event => event.kind === 'term' || event.kind === 'semester');
  const match = terms.find(event => date >= event.date && date <= (event.endDate ?? event.date));
  if (!match) return null;
  return { title: match.title, start: match.date, end: match.endDate ?? match.date };
}

export function movePlannerEvent(events: PlannerEvent[], id: string, date: string): PlannerEvent[] {
  return events.map(event => {
    if (event.id !== id) return event;
    const span = event.endDate ? Math.max(0, dateKeysBetween(event.date, event.endDate).length - 1) : 0;
    return { ...event, date, endDate: event.endDate ? addDays(date, span) : undefined };
  });
}

export function expandWeekly(event: PlannerEvent, until: string): PlannerEvent[] {
  if (event.recurrence !== 'weekly') return [event];
  const copies: PlannerEvent[] = [];
  let cursor = event.date;
  let guard = 0;
  while (cursor <= until && guard < 40) {
    const span = event.endDate ? Math.max(0, dateKeysBetween(event.date, event.endDate).length - 1) : 0;
    copies.push({
      ...event,
      id: guard === 0 ? event.id : `${event.id}-${cursor}`,
      date: cursor,
      endDate: event.endDate ? addDays(cursor, span) : undefined,
    });
    cursor = addDays(cursor, 7);
    guard += 1;
  }
  return copies;
}

export interface PlannerViewer {
  role: 'institution' | 'teacher' | 'parent' | 'student';
  campusId?: string;
  classId?: string;
  yearGroup?: string;
}

export function eventsForViewer(events: readonly PlannerEvent[], viewer: PlannerViewer): PlannerEvent[] {
  if (viewer.role === 'institution') return [...events];
  return events.filter(event => {
    if (event.campusId && viewer.campusId && event.campusId !== viewer.campusId) return false;
    if (event.classId && viewer.classId && event.classId !== viewer.classId) return false;
    if (event.yearGroup && viewer.yearGroup && event.yearGroup !== viewer.yearGroup) return false;
    if (event.audience === 'teachers' && viewer.role !== 'teacher') return false;
    if (event.audience === 'parents' && viewer.role === 'student') return false;
    return true;
  });
}

export function personalCopy(plan: YearPlan, ownerId: string, ownerRole: 'teacher' | 'parent'): YearPlan {
  return {
    ...plan,
    id: `${plan.id}-${ownerRole}-${ownerId}`,
    visibility: 'personal',
    ownerId,
    ownerRole,
    subscribeToken: undefined,
    events: plan.events.map(event => ({ ...event, id: `${ownerRole}-${event.id}` })),
  };
}

export function brandedTitle(brand: string): string {
  const name = brand.trim() || 'Poket School';
  return `${name} calendar`;
}

export function toIcs(plan: Pick<YearPlan, 'brand' | 'events'>): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Poket School//Year planner//EN',
    `X-WR-CALNAME:${brandedTitle(plan.brand)}`,
  ];
  for (const event of plan.events) {
    const start = event.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${event.id}@poketschool.ai`, `DTSTART;VALUE=DATE:${start}`, `SUMMARY:${event.title.replace(/\n/g, ' ')}`);
    if (event.endDate) lines.push(`DTEND;VALUE=DATE:${addDays(event.endDate, 1).replace(/-/g, '')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function upcomingReminders(events: readonly PlannerEvent[], today: string, withinDays = 7) {
  const end = addDays(today, withinDays);
  const kinds: PlannerKind[] = ['exam', 'event', 'assessment', 'report', 'ptm', 'revision'];
  return events
    .filter(event => kinds.includes(event.kind) && event.date >= today && event.date <= end)
    .map(event => ({ title: event.title, date: event.date, kind: event.kind }));
}

export function changeNotice(before: readonly PlannerEvent[], after: readonly PlannerEvent[]): { title: string; detail: string }[] {
  const prior = new Map(before.map(event => [event.id, event]));
  const next = new Map(after.map(event => [event.id, event]));
  const notes: { title: string; detail: string }[] = [];
  for (const event of after) {
    const old = prior.get(event.id);
    if (!old) notes.push({ title: 'Calendar date added', detail: `${event.title} is on ${event.date}.` });
    else if (old.date !== event.date) notes.push({ title: 'Calendar date moved', detail: `${event.title} moved from ${old.date} to ${event.date}.` });
  }
  for (const event of before) {
    if (!next.has(event.id)) notes.push({ title: 'Calendar date removed', detail: `${event.title} on ${event.date} was removed.` });
  }
  return notes;
}

export function monthCells(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - first + 1;
    return day >= 1 && day <= days ? day : null;
  });
}

const HOLIDAY_TEMPLATE: Record<'MY' | 'GB' | 'SG' | 'UN', string> = {
  MY: 'malaysia-2026',
  GB: 'uk-2026',
  SG: 'malaysia-2026',
  UN: 'uk-2026',
};

/** Exam-window templates do not list public holidays. Fill those in from the country. */
export function composeTemplate(templateId: string, country: 'MY' | 'GB' | 'SG' | 'UN' = 'UN'): PlannerEvent[] {
  const template = YEAR_TEMPLATES.find(row => row.id === templateId) ?? templateForCountry(country);
  const needsHolidays = template.id === 'igcse-2026' || template.id === 'alevel-2026';
  if (!needsHolidays) return template.events.map(event => ({ ...event }));
  const seen = new Set(template.events.map(event => `${event.date}|${event.title}`));
  const extras = holidayEvents(HOLIDAY_TEMPLATE[country])
    .filter(event => event.kind === 'holiday' && !seen.has(`${event.date}|${event.title}`))
    .map(event => ({ ...event, id: `auto-${event.id}` }));
  return [...template.events.map(event => ({ ...event })), ...extras];
}

export interface PlanScope {
  campusId?: string;
  classId?: string;
  yearGroup?: string;
}

const GENERATED_PREFIX = 'release-';
const ASSESSMENT_ID = 'milestone-assessment';
const REPORT_ID = 'milestone-report';

export function isGeneratedEvent(event: PlannerEvent): boolean {
  return event.id.startsWith(GENERATED_PREFIX) || event.id === ASSESSMENT_ID || event.id === REPORT_ID;
}

function nextSchoolDay(date: string, events: readonly PlannerEvent[]): string {
  let cursor = date;
  for (let guard = 0; guard < 28; guard += 1) {
    if (isSchoolDay(cursor, events)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return date;
}

/**
 * Content opens on teaching days. Assessments and report cards move off
 * holidays and exam weeks. Calling this again after a date change replaces
 * the generated rows.
 */
export function scheduleTerm(
  units: { id: string; title: string; lessons: string[] }[],
  start: string,
  end: string,
  events: readonly PlannerEvent[],
  scope: PlanScope = {},
): PlannerEvent[] {
  const pacing = replan(units, start, end, events);
  const releases: PlannerEvent[] = pacing.map((row, index) => ({
    id: `${GENERATED_PREFIX}${index + 1}`,
    title: `Release ${row.unitTitle}: ${row.lesson}`,
    date: row.date,
    kind: 'period',
    source: 'template',
    audience: 'students',
    period: 'Content release',
    ...scope,
  }));
  const miles = milestoneDates(end);
  return [
    ...releases,
    {
      id: ASSESSMENT_ID,
      title: 'Assessment',
      date: nextSchoolDay(miles.assessment, events),
      kind: 'assessment',
      source: 'template',
      audience: 'all',
      ...scope,
    },
    {
      id: REPORT_ID,
      title: 'Report cards',
      date: nextSchoolDay(miles.report, events),
      kind: 'report',
      source: 'template',
      audience: 'all',
      ...scope,
    },
  ];
}

export function rebuildPlan(
  units: { id: string; title: string; lessons: string[] }[],
  start: string,
  end: string,
  events: readonly PlannerEvent[],
  scope: PlanScope = {},
): PlannerEvent[] {
  const kept = events.filter(event => !isGeneratedEvent(event));
  return [...kept, ...scheduleTerm(units, start, end, kept, scope)];
}
