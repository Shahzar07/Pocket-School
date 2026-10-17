import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendImageMarkdown, bodyHasImage, illustrationBrief, includeLegacyVisuals,
  lessonBodyPatch, manuscriptToMarkdown, placeImageInLesson, readLessonBody,
  type LessonLibraryImage,
} from './lesson-body';

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

test('legacy pictures join the shared library once and leave the side field when placed', () => {
  const kept: LessonLibraryImage = { id: 'kept', src: 'https://cdn.example/kept.jpg', alt: 'Kept', width: 10, height: 10 };
  const library = includeLegacyVisuals(
    [kept],
    [
      { url: 'https://cdn.example/old.jpg', alt: 'Old chart', caption: 'Figure 1' },
      { url: 'https://cdn.example/kept.jpg', alt: 'Duplicate' },
      { url: '' },
    ],
  );
  assert.equal(library.length, 2);
  assert.equal(library[1]?.alt, 'Old chart');
  assert.equal(library[1]?.caption, 'Figure 1');

  const placed = placeImageInLesson({
    aiOutputs: {
      text: 'The lesson.',
      image: { url: 'https://cdn.example/old.jpg', alt: 'Old chart', placement: 'before' },
      summary: 'Stay',
    },
  }, { alt: 'Old chart', src: 'https://cdn.example/old.jpg', caption: 'Figure 1' });
  assert.equal(placed.aiOutputs.image, undefined);
  assert.equal(placed.aiOutputs.summary, 'Stay');
  assert.match(placed.aiOutputs.text ?? '', /old\.jpg/);
  assert.equal(bodyHasImage(placed.aiOutputs.text ?? '', 'https://cdn.example/old.jpg'), true);
  assert.equal(illustrationBrief('Too short'), '');
  assert.equal(illustrationBrief('A'.repeat(40)).length, 40);
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
