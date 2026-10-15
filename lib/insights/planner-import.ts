/**
 * Calendar imports stay drafts. A person publishes them from the year planner.
 * Photo and scanned-PDF reading needs an AI key; without one, the other
 * formats still import and the screen explains what to do instead.
 */

import { extractDatesFromText, parseCsv, parseIcs, type CalendarItem } from './calendar';
import { addDays } from './dates';
import {
  parseXlsxCalendar,
  subscribeTarget,
  type PlannerEvent,
  type PlannerKind,
} from './planner';

export const AI_CALENDAR_UNAVAILABLE =
  'Photo and scanned PDF reading needs an AI key on the server. Upload an ICS, CSV, or XLSX file, paste a Google or Outlook link, or type the dates. Nothing was published.';

const FETCHABLE_HOSTS = new Set([
  'calendar.google.com',
  'calendar.googleusercontent.com',
  'outlook.office365.com',
  'outlook.office.com',
  'outlook.live.com',
]);

export interface ImportDraft {
  events: PlannerEvent[];
  notice: string;
  needsReview: boolean;
}

function kindFromItem(type: CalendarItem['type']): PlannerKind {
  if (type === 'holiday') return 'holiday';
  if (type === 'exam') return 'exam';
  if (type === 'class') return 'period';
  return 'event';
}

/** ICS all-day DTEND is the first day that is not included. */
function inclusiveIcsEnd(start: string, end?: string): string | undefined {
  if (!end || end <= start) return undefined;
  const last = addDays(end, -1);
  return last > start ? last : undefined;
}

export function eventsFromItems(
  items: CalendarItem[],
  source: PlannerEvent['source'],
): PlannerEvent[] {
  return items.map((item, index) => ({
    id: `import-${index + 1}-${item.date}`,
    title: item.title.slice(0, 140),
    date: item.date,
    endDate: source === 'import' && item.source === 'import' ? inclusiveIcsEnd(item.date, item.endDate) : item.endDate,
    kind: kindFromItem(item.type),
    source,
    audience: 'all' as const,
    recurrence: 'none' as const,
  }));
}

export function importCalendarText(name: string, text: string): ImportDraft {
  const lower = name.toLowerCase();
  const csv = lower.endsWith('.csv') || /^\s*title\s*,/i.test(text);
  const items = csv ? parseCsv(text) : parseIcs(text);
  const events = eventsFromItems(items, 'import').map(event => (
    csv ? { ...event, endDate: items.find(item => item.title === event.title && item.date === event.date)?.endDate } : event
  ));
  return {
    events,
    needsReview: true,
    notice: events.length
      ? `${events.length} dates are ready to review. They stay a draft until someone publishes the year.`
      : 'No dates found. Use an ICS file, or a CSV with title and date columns.',
  };
}

export function importCalendarSheet(bytes: Uint8Array): ImportDraft {
  const items = parseXlsxCalendar(bytes).map(item => ({ ...item, source: 'import' as const }));
  const events = eventsFromItems(items, 'import').map(event => {
    const match = items.find(item => item.title === event.title && item.date === event.date);
    return { ...event, endDate: match?.endDate };
  });
  return {
    events,
    needsReview: true,
    notice: events.length
      ? `${events.length} spreadsheet rows are a draft. The copyright line is not a date.`
      : 'No dates found. The sheet needs title and date columns.',
  };
}

export function importPastedDates(text: string): ImportDraft {
  const events = eventsFromItems(extractDatesFromText(text), 'ai_draft');
  return {
    events,
    needsReview: true,
    notice: events.length
      ? 'These dates were read as a draft. Check each one before publishing.'
      : 'No dates found. Write one date per line, such as National Day 2026-08-31.',
  };
}

export function calendarLink(input: string): { url: string | null; notice: string } {
  const target = subscribeTarget(input);
  if (!target.icsUrl || !target.provider) {
    return { url: null, notice: 'Paste a Google or Outlook calendar link, or a webcal address.' };
  }
  let host = '';
  try {
    host = new URL(target.icsUrl).hostname.toLowerCase();
  } catch {
    return { url: null, notice: 'That link is not a calendar address.' };
  }
  if (!FETCHABLE_HOSTS.has(host)) {
    return {
      url: null,
      notice: 'Only Google and Outlook calendar links are fetched. Download the ICS file and upload it instead.',
    };
  }
  return { url: target.icsUrl, notice: '' };
}

export function draftsFromModelText(text: string): ImportDraft {
  return importPastedDates(text);
}

export function aiKeyPresent(env: object): boolean {
  const bag = env as { OPENROUTER_API_KEY?: string; GEMINI_API_KEY?: string };
  const openRouter = bag.OPENROUTER_API_KEY?.trim();
  const gemini = bag.GEMINI_API_KEY?.trim();
  if (!openRouter && !gemini) return false;
  if (openRouter && /^(your_|MY_|TODO)/i.test(openRouter)) return false;
  if (gemini && /^(your_|MY_|TODO)/i.test(gemini)) return false;
  return true;
}
