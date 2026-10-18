/** Career events. Times stay as wall-clock values in the event timezone. */

export type VenueKind = 'in_person' | 'online' | 'hybrid';

export interface CareerEvent {
  id: string;
  title: string;
  speaker: string;
  organiser: string;
  date: string;
  start: string;
  end: string;
  timezone: string;
  venueKind: VenueKind;
  address: string;
  mapUrl: string;
  onlineUrl: string;
  capacity: number;
  taken: number;
  eligibility: string;
  reminder: string;
}

export interface CareerRegistration {
  eventId: string;
  name: string;
  reminder: string;
}

export function seatsLeft(event: Pick<CareerEvent, 'capacity' | 'taken'>): number {
  return Math.max(0, event.capacity - event.taken);
}

export function stamp(date: string, time: string): string {
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');
  return `${year}${month}${day}T${hour}${minute}00`;
}

export function googleCalendarUrl(event: CareerEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.date, event.start)}/${stamp(event.date, event.end)}`,
    ctz: event.timezone,
    location: event.venueKind === 'online' ? event.onlineUrl : event.address,
    details: `${event.speaker} · ${event.organiser}. ${event.eligibility}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function icsFor(event: CareerEvent): string {
  const location = event.venueKind === 'online' ? event.onlineUrl : event.address;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Poket School//Career//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@poketschool.ai`,
    `DTSTART;TZID=${event.timezone}:${stamp(event.date, event.start)}`,
    `DTEND;TZID=${event.timezone}:${stamp(event.date, event.end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(`${event.speaker}. ${event.eligibility}. Reminder: ${event.reminder}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function rsvp(
  event: CareerEvent,
  registrations: readonly CareerRegistration[],
  person: string,
  reminder: string,
): { event: CareerEvent; registrations: CareerRegistration[]; accepted: boolean } {
  if (registrations.some((row) => row.eventId === event.id && row.name === person)) {
    return { event, registrations: [...registrations], accepted: true };
  }
  if (seatsLeft(event) < 1) return { event, registrations: [...registrations], accepted: false };
  return {
    event: { ...event, taken: event.taken + 1 },
    registrations: [...registrations, { eventId: event.id, name: person, reminder }],
    accepted: true,
  };
}

export function upsertEvent(events: readonly CareerEvent[], next: CareerEvent): CareerEvent[] {
  const rest = events.filter((event) => event.id !== next.id);
  return [...rest, next].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

export function removeEvent(events: readonly CareerEvent[], id: string): CareerEvent[] {
  return events.filter((event) => event.id !== id);
}

export const ROCHFORD_EVENTS: CareerEvent[] = [
  {
    id: 'clinic-chemistry',
    title: 'Chemistry clinic',
    speaker: 'Dr Leah Tan',
    organiser: "Rochford's International School",
    date: '2026-11-12',
    start: '16:00',
    end: '17:30',
    timezone: 'Asia/Kuala_Lumpur',
    venueKind: 'hybrid',
    address: 'Lecture theatre, Rochford campus, Kuala Lumpur',
    mapUrl: 'https://maps.google.com/?q=Kuala+Lumpur',
    onlineUrl: 'https://meet.google.com/rochford-chemistry',
    capacity: 40,
    taken: 18,
    eligibility: 'IGCSE and A Level science students',
    reminder: '1 day before',
  },
  {
    id: 'talk-medicine',
    title: 'A day in medicine',
    speaker: 'Omar Haddad',
    organiser: 'Alumni office',
    date: '2026-11-19',
    start: '18:00',
    end: '19:00',
    timezone: 'Asia/Kuala_Lumpur',
    venueKind: 'online',
    address: '',
    mapUrl: '',
    onlineUrl: 'https://meet.google.com/rochford-medicine',
    capacity: 80,
    taken: 22,
    eligibility: 'Open to A Level students and alumni',
    reminder: '1 hour before',
  },
  {
    id: 'fair-careers',
    title: 'Campus careers fair',
    speaker: 'Careers team',
    organiser: "Rochford's International School",
    date: '2026-12-03',
    start: '10:00',
    end: '14:00',
    timezone: 'Asia/Kuala_Lumpur',
    venueKind: 'in_person',
    address: 'Sports hall, Rochford campus, Kuala Lumpur',
    mapUrl: 'https://maps.google.com/?q=Kuala+Lumpur+sports+hall',
    onlineUrl: '',
    capacity: 200,
    taken: 64,
    eligibility: 'Current students and opted-in alumni',
    reminder: '1 day before',
  },
];
