import assert from 'node:assert/strict';
import test from 'node:test';
import { flagAbsences } from './absences';
import { pushGoogleEvents } from './client';
import { decryptRefreshToken, encryptRefreshToken } from './crypto';
import { eventsFromTimetable, filterByToggles, DEFAULT_TOGGLES } from './events';
import { applyAvailability, busyToUnavailable } from './freebusy';
import { newFeedNonce, signFeedToken, verifyFeedToken } from './ical-link';
import { googleEventId, planSync } from './mapping';
import { schoolTimetable } from '@/lib/timetable/seed';
import { hardViolations } from '@/lib/timetable/clashes';
import { solveTimetable } from '@/lib/timetable/solver';
import type { Lesson } from '@/lib/timetable/types';
import { applyWorkspace, importWorkspaceEvents } from './workspace';

const periods = schoolTimetable().periods;

test('the same lesson always gets the same Google event id', () => {
  const first = googleEventId('lesson:maths-p2-1');
  const second = googleEventId('lesson:maths-p2-1');
  assert.equal(first, second);
  assert.notEqual(first, googleEventId('lesson:maths-p2-2'));
  assert.match(first, /^poket[0-9a-v]+$/);
});

test('republish updates the same events and deletes only what left the week', () => {
  const events = [
    { sourceId: 'lesson:a', kind: 'timetable' as const, title: 'Maths', date: '2026-10-19', startTime: '08:30', endTime: '09:15' },
    { sourceId: 'lesson:b', kind: 'timetable' as const, title: 'English', date: '2026-10-19', startTime: '09:20', endTime: '10:05' },
    { sourceId: 'lesson:a', kind: 'timetable' as const, title: 'Maths moved', date: '2026-10-20', startTime: '08:30', endTime: '09:15' },
  ];
  const first = planSync(events, []);
  assert.equal(first.upserts.length, 2);
  assert.deepEqual(first.deletes, []);
  const ids = first.upserts.map(event => event.id);
  const again = planSync(events, ids);
  assert.deepEqual(again.upserts.map(event => event.id).sort(), ids.sort());
  assert.deepEqual(again.deletes, []);
  const kept = events.filter(event => event.sourceId !== 'lesson:b');
  const after = planSync(kept, ids);
  assert.equal(after.upserts.length, 1);
  assert.equal(after.deletes.length, 1);
  assert.equal(after.deletes[0], googleEventId('lesson:b'));
  assert.equal(after.upserts[0]?.summary, 'Maths moved');
});

test('a fake Google calendar patches the same id and does not insert a second copy', async () => {
  const events = new Map<string, { summary?: string }>();
  let posts = 0;
  let patches = 0;
  let deletes = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const match = /\/events\/([^/?]+)$/.exec(url);
    const id = match ? decodeURIComponent(match[1] ?? '') : '';
    if (method === 'PATCH' && id) {
      patches += 1;
      if (!events.has(id)) return new Response('missing', { status: 404 });
      events.set(id, JSON.parse(String(init?.body)) as { summary?: string });
      return new Response('{}', { status: 200 });
    }
    if (method === 'POST' && url.endsWith('/events')) {
      posts += 1;
      const body = JSON.parse(String(init?.body)) as { id: string; summary?: string };
      events.set(body.id, body);
      return new Response(JSON.stringify(body), { status: 200 });
    }
    if (method === 'DELETE' && id) {
      deletes += 1;
      events.delete(id);
      return new Response(null, { status: 204 });
    }
    return new Response('{}', { status: 200 });
  };
  const source = [
    { sourceId: 'lesson:a', kind: 'timetable' as const, title: 'Maths', date: '2026-10-19', startTime: '08:30', endTime: '09:15' },
    { sourceId: 'cover:c1', kind: 'cover' as const, title: 'Cover Ms Adeyemi', date: '2026-10-19', startTime: '08:30', endTime: '09:15' },
  ];
  const first = await pushGoogleEvents({ fetchImpl, accessToken: 'access', calendarId: 'poket', events: source, previousIds: [] });
  assert.equal(posts, 2);
  assert.equal(events.size, 2);
  const second = await pushGoogleEvents({ fetchImpl, accessToken: 'access', calendarId: 'poket', events: source, previousIds: first.ids });
  assert.equal(posts, 2);
  assert.equal(patches, 4);
  assert.equal(deletes, 0);
  assert.equal(events.size, 2);
  assert.deepEqual(second.ids.sort(), first.ids.sort());
  await pushGoogleEvents({
    fetchImpl,
    accessToken: 'access',
    calendarId: 'poket',
    events: source.filter(event => event.kind !== 'cover'),
    previousIds: second.ids,
  });
  assert.equal(deletes, 1);
  assert.equal(events.size, 1);
  assert.equal(posts, 2);
});

test('approved cover, exams, and assignment dates are mapped once', () => {
  const doc = schoolTimetable();
  const solved = solveTimetable(doc);
  doc.lessons = solved.lessons;
  const lesson = doc.lessons[0] as Lesson;
  doc.covers = [{
    id: 'cover-1',
    lessonId: lesson.id,
    date: '2026-10-19',
    absentTeacherId: lesson.teacherId,
    coverTeacherId: 'yusuf',
    roomId: lesson.roomId,
    reason: 'leave',
    status: 'approved',
  }];
  const events = eventsFromTimetable(doc, [lesson], {
    covers: doc.covers,
    exams: [{ id: 'exam-1', title: 'Maths paper', date: '2026-11-02', start: '09:00', end: '11:00' }],
    assignments: [{ id: 'hw-1', title: 'Essay', due: '2026-10-23' }],
    planner: [{ id: 'tt-skip', title: 'Already a lesson', date: '2026-10-19', kind: 'period' }, { id: 'sports', title: 'Sports day', date: '2026-10-30', kind: 'event' }],
  });
  const ids = events.map(event => googleEventId(event.sourceId));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(events.filter(event => event.kind === 'cover').length, 1);
  assert.equal(events.some(event => event.sourceId === 'planner:tt-skip'), false);
  const hidden = filterByToggles(events, { ...DEFAULT_TOGGLES, cover: false, exams: false });
  assert.equal(hidden.some(event => event.kind === 'cover' || event.kind === 'exam'), false);
});

test('free/busy in the anchor week becomes solver unavailability only when applied', () => {
  const slots = busyToUnavailable(
    [{ start: '2026-10-20T00:40:00Z', end: '2026-10-20T01:00:00Z' }, { start: '2026-11-03T00:40:00Z', end: '2026-11-03T01:00:00Z' }],
    periods,
    '2026-10-19',
  );
  assert.deepEqual(slots, ['tue:p1']);
  const doc = schoolTimetable();
  const once = applyAvailability(doc, 'chen', slots);
  const twice = applyAvailability(once, 'chen', slots);
  assert.deepEqual(once.staff.find(person => person.id === 'chen')?.unavailable, ['fri:p5', 'fri:p6', 'tue:p1']);
  assert.deepEqual(twice.staff.find(person => person.id === 'chen')?.unavailable, once.staff.find(person => person.id === 'chen')?.unavailable);
  assert.deepEqual(doc.staff.find(person => person.id === 'chen')?.unavailable, ['fri:p5', 'fri:p6']);
});

test('Google leave is flagged and never marked applied', () => {
  const flagged = flagAbsences([
    { id: '1', summary: 'Annual leave', date: '2026-10-21', calendarId: 'primary' },
    { id: '2', summary: 'Staff meeting', date: '2026-10-21', calendarId: 'primary' },
    { id: '3', summary: 'Assembly', date: '2026-10-22', calendarId: 'absences' },
  ], { keyword: 'leave', absenceCalendarId: 'absences' });
  assert.equal(flagged.length, 2);
  assert.deepEqual(flagged.map(item => item.applied), [false, false]);
  assert.equal(flagged[0]?.reason, 'leave');
  assert.equal(flagged[1]?.reason, 'absent');
  assert.equal(JSON.stringify(flagged).includes('"applied":true'), false);
});

test('school calendars import as blocks without duplicating ids', () => {
  const doc = schoolTimetable();
  doc.lessons = [{
    id: 'l1',
    subjectId: 'maths-p2',
    groupId: 'g-oak',
    teacherId: 'rahman',
    roomId: 'r-a',
    day: 'tue',
    periodId: 'p1',
    campusId: 'main',
  }];
  const source = [
    { id: 'deepavali-g', summary: 'School holiday', date: '2026-11-09', calendar: 'school' as const },
    { id: 'term-2', summary: 'Term 2', date: '2027-01-05', endDate: '2027-03-20', calendar: 'school' as const },
    { id: 'lab-book', summary: 'Room A parents evening', date: '2026-10-20', startTime: '08:30', endTime: '09:15', calendar: 'rooms' as const },
  ];
  const imported = importWorkspaceEvents(source, doc.periods, doc.rooms);
  const next = applyWorkspace(doc, imported);
  const again = applyWorkspace(next, imported);
  assert.equal(again.holidays.filter(holiday => holiday.id.startsWith('gcal:')).length, 1);
  assert.equal(again.terms.filter(term => term.id === 'gcal-term:term-2').length, 1);
  assert.equal(again.roomHolds?.length, next.roomHolds?.length);
  assert.equal(hardViolations(next, next.lessons).some(clash => clash.message.includes('school calendar')), true);
});

test('refresh tokens round-trip and a regenerated iCal link dies', () => {
  const secret = 'test-secret';
  const cipher = encryptRefreshToken('refresh-1', secret);
  assert.equal(decryptRefreshToken(cipher, secret), 'refresh-1');
  assert.notEqual(encryptRefreshToken('refresh-1', secret), cipher);
  assert.throws(() => decryptRefreshToken(cipher, 'other-secret'));
  const nonce = newFeedNonce();
  const token = signFeedToken('uid-1', nonce, secret);
  assert.deepEqual(verifyFeedToken(token, secret), { uid: 'uid-1', nonce });
  assert.equal(verifyFeedToken(token, 'other-secret'), null);
  const rotated = newFeedNonce();
  assert.notEqual(verifyFeedToken(token, secret)?.nonce, rotated);
});
