import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ageBand,
  fallbackStory,
  fullPageImage,
  isPictureBook,
  pictureSpreads,
  readerFontFamily,
  readerTypeface,
  storyPublishIssues,
  withPageIllustration,
  wordsOf,
} from './picture-book';

test('a children’s story uses an age band and one full-page picture', () => {
  const story = fallbackStory('the yellow window', '5-7');
  assert.equal(ageBand('5-7').label, 'Ages 5–7');
  assert.match(story.blurb, /Ages 5–7/);
  assert.doesNotMatch(`${story.title} ${story.blurb} ${story.chapters.map(page => page.text).join(' ')}`, /Year\s+\d/);
  assert.equal(story.chapters.length, 3);
  const page = withPageIllustration(story.chapters[0].text, 'The window', 'data:image/svg+xml,abc');
  assert.match(page, /^!full\[The window\]/);
  const spreads = pictureSpreads(page);
  assert.equal(spreads.length, 1);
  assert.equal(spreads[0]?.image?.alt, 'The window');
  const withParens = pictureSpreads(`${fullPageImage('Rain', 'data:image/svg+xml,hsl(10,20%,30%)')}\n\nRain on the glass.`);
  assert.equal(withParens[0]?.image?.src, 'data:image/svg+xml,hsl(10,20%,30%)');
  assert.match(withParens[0]?.text ?? '', /Rain on the glass/);
  assert.match(spreads[0]?.text ?? '', /yellow/);
  assert.deepEqual(wordsOf(spreads[0]?.text ?? ''), wordsOf(story.chapters[0].text));
});

test('picture books are a catalogue category and still need a picture to publish', () => {
  assert.equal(isPictureBook({ category: 'childrens_stories' }), true);
  assert.equal(isPictureBook({ genre: "Children's Stories" }), true);
  assert.equal(isPictureBook({ category: 'general' }), false);
  const blocked = storyPublishIssues({
    pictureBook: true,
    chapters: [{ title: 'The window', markdown: 'Rain on the glass.' }],
  });
  assert.match(blocked[0] ?? '', /illustration/);
  const ready = storyPublishIssues({
    pictureBook: true,
    chapters: [{ title: 'The window', markdown: fullPageImage('The window', 'data:image/svg+xml,1') + '\n\nRain.' }],
  });
  assert.deepEqual(ready, []);
});

test('typeface choices cover every book, including a dyslexia-friendly face', () => {
  assert.equal(readerTypeface({ dyslexia: true }), 'dyslexia');
  assert.equal(readerTypeface({ typeface: 'sans', dyslexia: false }), 'sans');
  assert.match(readerFontFamily('dyslexia'), /Lexend/);
  assert.match(readerFontFamily('serif'), /Georgia/);
  assert.match(readerFontFamily('sans'), /Verdana/);
});
