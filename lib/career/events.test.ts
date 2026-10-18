import assert from 'node:assert/strict';
import test from 'node:test';
import { googleCalendarUrl, icsFor, ROCHFORD_EVENTS, rsvp, seatsLeft } from './events';

test('a hybrid clinic keeps seats, a calendar link, and an ics file', () => {
  const clinic = ROCHFORD_EVENTS[0];
  assert.ok(clinic);
  assert.equal(seatsLeft(clinic), 22);
  assert.match(googleCalendarUrl(clinic), /calendar\.google\.com/);
  assert.match(googleCalendarUrl(clinic), /Asia%2FKuala_Lumpur|Asia\/Kuala_Lumpur/);
  const file = icsFor(clinic);
  assert.match(file, /DTSTART;TZID=Asia\/Kuala_Lumpur:20261112T160000/);
  assert.match(file, /SUMMARY:Chemistry clinic/);
});

test('rsvp takes one seat and does not double-book the same person', () => {
  const clinic = ROCHFORD_EVENTS[0];
  assert.ok(clinic);
  const first = rsvp(clinic, [], 'Amina Rahman', '1 day before');
  assert.equal(first.accepted, true);
  assert.equal(seatsLeft(first.event), 21);
  const second = rsvp(first.event, first.registrations, 'Amina Rahman', '1 day before');
  assert.equal(second.registrations.length, 1);
  assert.equal(seatsLeft(second.event), 21);
});
