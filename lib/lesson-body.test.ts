import assert from 'node:assert/strict';
import test from 'node:test';
import { appendImageMarkdown, lessonBodyPatch, manuscriptToMarkdown, readLessonBody } from './lesson-body';

test('readLessonBody prefers the edited text and falls back to the manuscript', () => {
  assert.equal(readLessonBody({
    aiOutputs: { text: 'Edited lesson' },
    contentSources: [{ type: 'text', value: 'Original notes' }],
  }), 'Edited lesson');
  assert.equal(readLessonBody({
    contentSources: [{ type: 'text', value: 'Original notes' }],
  }), 'Original notes');
  assert.equal(readLessonBody(null), '');
});

test('lessonBodyPatch writes the body to both stores and keeps other sources', () => {
  const patch = lessonBodyPatch({
    contentSources: [{ type: 'url', value: 'https://example.com' }],
    aiOutputs: { summary: 'Keep me' },
  }, 'New body');
  assert.deepEqual(patch.contentSources, [
    { type: 'text', value: 'New body' },
    { type: 'url', value: 'https://example.com' },
  ]);
  assert.equal(patch.aiOutputs.text, 'New body');
  assert.equal(patch.aiOutputs.summary, 'Keep me');
});

test('manuscriptToMarkdown turns imported headings into one lesson', () => {
  const markdown = manuscriptToMarkdown([
    { title: 'Opening', body: 'Start here.' },
    { title: 'Cells', body: 'Cells are small.' },
  ]);
  assert.equal(markdown, 'Start here.\n\n## Cells\n\nCells are small.');
});

test('appendImageMarkdown places a captioned full-page picture', () => {
  const next = appendImageMarkdown('The lesson.', {
    alt: 'A cell',
    src: 'https://cdn.example/cell.jpg',
    caption: 'Figure 1',
    fullBleed: true,
  });
  assert.equal(next, 'The lesson.\n\n!full[A cell](https://cdn.example/cell.jpg "Figure 1")');
});
