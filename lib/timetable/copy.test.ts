import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TIMETABLE_COPY } from './copy';

test('the timetable note does not name a server secret', () => {
  assert.equal(TIMETABLE_COPY.modelNote.includes('OPENROUTER'), false);
  assert.equal(TIMETABLE_COPY.modelNote.includes('API_KEY'), false);
  assert.match(TIMETABLE_COPY.modelNote, /timetable/i);
});
