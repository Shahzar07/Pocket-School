import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TIMETABLE_COPY } from './copy';

test('the timetable note does not name a server secret', () => {
  assert.equal(TIMETABLE_COPY.modelNote.includes('OPENROUTER'), false);
  assert.equal(TIMETABLE_COPY.modelNote.includes('API_KEY'), false);
  assert.match(TIMETABLE_COPY.modelNote, /timetable/i);
});

test('timetable panels that are white in light mode have a dark ink surface', () => {
  const files = [
    new URL('../../components/timetable/desk.tsx', import.meta.url),
    new URL('../../components/calendar/google-sync.tsx', import.meta.url),
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const line of source.split('\n')) {
      if (!line.includes('bg-white')) continue;
      assert.match(line, /dark:bg-\[#(0B1417|122226)\]/, line.trim());
    }
  }
});
