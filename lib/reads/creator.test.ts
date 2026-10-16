import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOOK_KINDS, buildOutline, chaptersFromOutline, checkContinuity, craftOf, hasTool, kindShape, languageChoices, promptsFor, proposeBook, reviseProse, sparkNote, toolsFor,
} from './creator';

test('every book category has a desk, and academic tools are not a plot board', () => {
  const ids = BOOK_KINDS.map(kind => kind.id);
  for (const id of ['fiction', 'childrens', 'textbook', 'revision', 'workbook', 'nonfiction', 'biography', 'self-help', 'law', 'medicine', 'engineering', 'nursing', 'language']) {
    assert.ok(ids.includes(id), id);
  }
  assert.deepEqual(toolsFor('fiction'), ['characters', 'world', 'plot']);
  assert.equal(hasTool('textbook', 'plot'), false);
  assert.equal(hasTool('textbook', 'syllabus'), true);
  assert.equal(hasTool('textbook', 'quiz'), true);
  assert.equal(hasTool('workbook', 'exercises'), true);
  assert.equal(hasTool('law', 'references'), true);
  assert.equal(hasTool('biography', 'characters'), true);
  assert.equal(hasTool('language', 'glossary'), true);
  const shape = kindShape('law');
  assert.equal(shape.readingLevel, 'law');
  assert.equal('priceRM' in shape, false);
  assert.equal('priceUsd' in shape, false);
});

test('a one-line idea becomes a proposal, an outline, and a chapter the author can shorten', () => {
  const story = proposeBook('a yellow window', 'childrens');
  assert.match(story.audience, /Ages 5–7/);
  assert.doesNotMatch(`${story.titles.join(' ')} ${story.logline}`, /Year\s+\d/);
  const pages = buildOutline({ idea: 'cells', title: 'Cells', kindId: 'workbook', structure: 'workbook', objectives: ['Name the parts of a cell'] });
  assert.equal(pages.length, 4);
  assert.match(pages[0]?.exercise?.answer ?? '', /Name the parts/);
  const chapters = chaptersFromOutline(pages, 'wb');
  assert.match(chapters[0]?.markdown ?? '', /## Answer/);
  assert.equal(chapters[0]?.quiz?.[0]?.answer, 'Name the parts of a cell');
  const long = reviseProse('One. Two. Three. Four.', 'expand', 'cells');
  const short = reviseProse(long, 'shorten', 'cells');
  assert.ok(short.length < long.length);
  const spreads = buildOutline({ idea: 'rain', title: 'Rain', kindId: 'childrens', structure: 'picture-12' });
  assert.equal(spreads.length, 12);
});

test('the continuity check follows the kind of book', () => {
  const fiction = checkContinuity({
    chapters: [{ id: 'a', order: 0, title: 'Start', markdown: 'The road was empty.' }],
    craft: { ...craftOf({}), characters: [{ id: '1', name: 'Amina', role: 'hero', traits: '', appearance: '', backstory: '', voice: '', relationships: '' }] },
    pictureBook: false,
  });
  assert.match(fiction.map(note => note.message).join(' '), /Amina/);
  const guide = checkContinuity({
    chapters: [{ id: 'a', order: 0, title: 'Teach', markdown: 'Read the paragraph.' }],
    craft: { ...craftOf({ category: 'academic' }), kind: 'workbook', objectives: [], glossary: [], references: [], characters: [], scenes: [], customPrompts: [], titles: [], idea: '', logline: '', tone: '', audience: '', language: 'en', styleId: 'academic', structure: 'workbook', worldName: '', worldTime: '', worldPlace: '', worldRules: '' },
    pictureBook: false,
  });
  assert.match(guide.map(note => note.message).join(' '), /answer/);
});

test('prompts and languages come from the shared catalogs', () => {
  assert.ok(promptsFor('childrens').some(prompt => prompt.name === 'Bedtime story'));
  assert.ok(promptsFor('law').some(prompt => prompt.name === 'Law note'));
  assert.ok(promptsFor('medicine').some(prompt => /dose/i.test(prompt.body)));
  const languages = languageChoices();
  assert.ok(languages.length >= 20);
  assert.ok(languages.some(language => language.code === 'ms'));
  assert.match(sparkNote('portrait', true), /0 Sparks/);
  assert.match(sparkNote('portrait', false), /5 Sparks/);
});
