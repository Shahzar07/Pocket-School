import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { previewIntent } from './chat';
import { parsePaperTimetable, pngWithText, textChunksFromPng } from './paper';
import { schoolTimetable } from './seed';

const PAPER = 'Monday, P1, Maths, Primary 2, Ms Rahman, Room A';

describe('paper timetable OCR', () => {
  it('reads a photographed timetable from the image text and previews it', () => {
    const png = pngWithText(PAPER);
    const text = textChunksFromPng(png).join('\n');
    const rows = parsePaperTimetable(text);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.level, 'Primary 2');
    const preview = previewIntent(schoolTimetable(), { type: 'import', rows });
    assert.equal(preview.confirmable, true);
    assert.equal(preview.doc.lessons.length, 1);
    assert.equal(preview.doc.lessons[0]?.day, 'mon');
  });
});
