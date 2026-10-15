import { addDays, dateKeysBetween, weekdayOf } from './dates';

export type CalendarItemType = 'assignment' | 'exam' | 'event' | 'holiday' | 'class' | 'payment';

export interface CalendarItem {
  title: string;
  date: string;
  endDate?: string;
  type: CalendarItemType;
  description?: string;
  campusId?: string;
  classId?: string;
  source?: 'manual' | 'import' | 'template' | 'ai_draft';
}

export interface CalendarTemplate {
  id: string;
  label: string;
  note: string;
  items: CalendarItem[];
}

const holiday = (title: string, date: string, description?: string): CalendarItem => ({
  title, date, type: 'holiday', description, source: 'template',
});
const exam = (title: string, date: string, endDate: string): CalendarItem => ({
  title, date, endDate, type: 'exam', description: 'Exam window. Confirm the board timetable before publishing.', source: 'template',
});

/**
 * Starting points a school confirms. Religious dates move; they are labelled
 * so nobody treats the template as the official gazette.
 */
export const CALENDAR_TEMPLATES: readonly CalendarTemplate[] = [
  {
    id: 'malaysia-2026',
    label: 'Malaysia public holidays 2026',
    note: 'Confirm Hari Raya, Wesak, and Deepavali against the state gazette before you publish.',
    items: [
      holiday('New Year', '2026-01-01'),
      holiday('Chinese New Year', '2026-02-17'),
      holiday('Chinese New Year (second day)', '2026-02-18'),
      holiday('Hari Raya Aidilfitri (confirm)', '2026-03-20', 'Date moves with the moon. Confirm before publishing.'),
      holiday('Hari Raya Aidilfitri (second day, confirm)', '2026-03-21'),
      holiday('Labour Day', '2026-05-01'),
      holiday('Wesak Day (confirm)', '2026-05-31'),
      holiday("Yang di-Pertuan Agong's birthday", '2026-06-06', 'First Saturday of June.'),
      holiday('Awal Muharram (confirm)', '2026-06-16'),
      holiday('National Day', '2026-08-31'),
      holiday("Prophet Muhammad's birthday (confirm)", '2026-08-25'),
      holiday('Malaysia Day', '2026-09-16'),
      holiday('Deepavali (confirm)', '2026-11-08'),
      holiday('Christmas', '2026-12-25'),
    ],
  },
  {
    id: 'uk-2026',
    label: 'UK bank holidays 2026',
    note: 'England and Wales. Scotland and Northern Ireland differ.',
    items: [
      holiday('New Year', '2026-01-01'),
      holiday('Good Friday', '2026-04-03'),
      holiday('Easter Monday', '2026-04-06'),
      holiday('Early May bank holiday', '2026-05-04'),
      holiday('Spring bank holiday', '2026-05-25'),
      holiday('Summer bank holiday', '2026-08-31'),
      holiday('Christmas Day', '2026-12-25'),
      holiday('Boxing Day', '2026-12-28', 'Substitute day, because Boxing Day falls on a Saturday.'),
    ],
  },
  {
    id: 'igcse-2026',
    label: 'IGCSE exam windows 2026',
    note: 'Cambridge-style windows. Use the official timetable for each paper.',
    items: [
      exam('IGCSE May/June window', '2026-04-27', '2026-06-12'),
      exam('IGCSE October/November window', '2026-10-05', '2026-11-13'),
    ],
  },
  {
    id: 'alevel-2026',
    label: 'A-Level exam windows 2026',
    note: 'Confirm against the board timetable. Papers are not evenly spread inside the window.',
    items: [
      exam('A-Level May/June window', '2026-05-04', '2026-06-26'),
      exam('A-Level October/November window', '2026-10-05', '2026-11-20'),
    ],
  },
];

function unfoldIcs(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r\n/g, '\n');
}

function icsDate(value: string): string | null {
  const match = value.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseIcs(text: string): CalendarItem[] {
  const items: CalendarItem[] = [];
  const body = unfoldIcs(text);
  const blocks = body.split('BEGIN:VEVENT').slice(1);
  for (const block of blocks) {
    const event = block.split('END:VEVENT')[0] ?? '';
    const line = (name: string) => {
      const found = event.split('\n').find(row => row.startsWith(name));
      return found ? found.slice(found.indexOf(':') + 1).trim() : '';
    };
    const date = icsDate(line('DTSTART'));
    const title = line('SUMMARY');
    if (!date || !title) continue;
    const end = icsDate(line('DTEND'));
    items.push({
      title,
      date,
      endDate: end && end !== date ? end : undefined,
      description: line('DESCRIPTION') || undefined,
      type: /exam/i.test(title) ? 'exam' : /holiday/i.test(title) ? 'holiday' : 'event',
      source: 'import',
    });
  }
  return items;
}

export function parseCsv(text: string): CalendarItem[] {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(row => row.trim());
  if (rows.length < 2) return [];
  const headers = splitCsvLine(rows[0]).map(h => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const titleI = idx('title');
  const dateI = idx('date');
  if (titleI < 0 || dateI < 0) return [];
  const typeI = idx('type');
  const descI = idx('description');
  const endI = idx('end');
  const items: CalendarItem[] = [];
  for (const row of rows.slice(1)) {
    const cells = splitCsvLine(row);
    const title = cells[titleI]?.trim();
    const date = cells[dateI]?.trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const type = (cells[typeI]?.trim().toLowerCase() ?? 'event') as CalendarItemType;
    const allowed: CalendarItemType[] = ['assignment', 'exam', 'event', 'holiday', 'class', 'payment'];
    items.push({
      title,
      date,
      endDate: cells[endI]?.trim() || undefined,
      description: cells[descI]?.trim() || undefined,
      type: allowed.includes(type) ? type : 'event',
      source: 'import',
    });
  }
  return items;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else current += ch;
  }
  cells.push(current);
  return cells;
}

/** Dates mentioned in free text, for a teacher to accept or discard. Never published on its own. */
export function extractDatesFromText(text: string): CalendarItem[] {
  const items: CalendarItem[] = [];
  const lines = text.split(/\r?\n/);
  const iso = /(\d{4}-\d{2}-\d{2})/;
  const dmy = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isoMatch = trimmed.match(iso);
    const dmyMatch = trimmed.match(dmy);
    let date = '';
    if (isoMatch) date = isoMatch[1];
    else if (dmyMatch) {
      date = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    }
    if (!date) continue;
    const title = trimmed.replace(iso, '').replace(dmy, '').replace(/^[\s\-–:]+|[\s\-–:]+$/g, '').slice(0, 120) || 'Imported date';
    items.push({ title, date, type: /holiday/i.test(trimmed) ? 'holiday' : /exam/i.test(trimmed) ? 'exam' : 'event', source: 'ai_draft' });
  }
  return items;
}

export function teachingMondays(start: string, end: string, holidays: readonly string[]): string[] {
  const holiday = new Set(holidays);
  return dateKeysBetween(start, end).filter(key => weekdayOf(key) === 1 && !holiday.has(key));
}

export function mapUnitsToWeeks(
  units: { id: string; title: string }[],
  weeks: string[],
): { unitId: string; title: string; weekStart: string }[] {
  if (!units.length || !weeks.length) return [];
  const perWeek = Math.ceil(units.length / weeks.length);
  return units.map((unit, index) => ({
    unitId: unit.id,
    title: unit.title,
    weekStart: weeks[Math.min(weeks.length - 1, Math.floor(index / perWeek))],
  }));
}

/** One lesson per weekday from the teaching week, skipping holidays. */
export function dripDates(weekStart: string, lessonCount: number, holidays: readonly string[]): string[] {
  const holiday = new Set(holidays);
  const dates: string[] = [];
  let cursor = weekStart;
  let guard = 0;
  while (dates.length < lessonCount && guard < 40) {
    const day = weekdayOf(cursor);
    if (day !== 0 && day !== 6 && !holiday.has(cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

export function moveItem(item: CalendarItem, date: string): CalendarItem {
  const span = item.endDate ? daysBetween(item.date, item.endDate) : 0;
  return { ...item, date, endDate: span ? addDays(date, span) : item.endDate ? addDays(date, span) : undefined };
}

function daysBetween(start: string, end: string): number {
  const a = dateKeysBetween(start, end);
  return Math.max(0, a.length - 1);
}
