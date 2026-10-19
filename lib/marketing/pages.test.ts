import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { MARKET_LINKS } from './nav';
import { MARKET_PAGES } from './pages';

test('every marketing link has a page', () => {
  for (const link of MARKET_LINKS) {
    if (link.href.startsWith('mailto:')) continue;
    const slug = link.href.split('?')[0].replace(/^\//, '');
    assert.equal(existsSync(`app/${slug}/page.tsx`), true, link.href);
  }
  assert.equal(MARKET_PAGES.length >= 12, true);
});

test('about page tells the Ipoh story and the homepage points at it', () => {
  const about = MARKET_PAGES.find((page) => page.slug === 'about');
  const story = about?.sections.find((section) => section.id === 'our-story');
  assert.equal(story?.heading, 'Our story');
  assert.match(story?.body ?? '', /school of entrepreneurship and success/);
  assert.match(story?.body ?? '', /City of Millionaires/);
  assert.match(story?.body ?? '', /21st century and beyond/);
  assert.match(story?.body ?? '', /Lifelong learning/);
  assert.equal(story?.points.some((point) => point.includes('Ipoh - The City of Millionaires')), true);
  const home = readFileSync('lib/marketing/home.ts', 'utf8');
  assert.match(home, /storyHref: '\/about#our-story'/);
  assert.equal(home.includes('tin '), false);
});

test('landing copy avoids gold and numbered school years', () => {
  const home = readFileSync('lib/marketing/home.ts', 'utf8');
  const pages = readFileSync('lib/marketing/pages.ts', 'utf8');
  for (const source of [home, pages]) {
    assert.equal(source.includes('#C8820A'), false);
    assert.equal(source.includes('Years 1'), false);
    assert.equal(source.includes('Year 10'), false);
  }
});

test('copyright signatures cannot be updated in the rules', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const start = rules.indexOf('match /copyright_signatures/');
  const end = rules.indexOf('match /grades/');
  const block = rules.slice(start, end);
  assert.match(block, /allow update, delete: if false/);
  assert.match(block, /instructor_application/);
  assert.match(rules, /match \/planner_events\//);
});
