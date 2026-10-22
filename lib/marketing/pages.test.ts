import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { MARKET_LINKS } from './nav';
import { MARKET_PAGES } from './pages';

/** A public route may sit in a route group, such as `app/reads/(shelf)/page.tsx`. */
function pageExists(slug: string): boolean {
  const segments = slug.split('/').filter(Boolean);
  const walk = (dir: string, index: number): boolean => {
    if (!existsSync(dir)) return false;
    if (index === segments.length) {
      if (existsSync(path.join(dir, 'page.tsx'))) return true;
    } else {
      const next = path.join(dir, segments[index]);
      if (existsSync(next) && walk(next, index + 1)) return true;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('(')) continue;
      if (walk(path.join(dir, entry.name), index)) return true;
    }
    return false;
  };
  return walk('app', 0);
}

test('every marketing link has a page', () => {
  for (const link of MARKET_LINKS) {
    if (link.href.startsWith('mailto:')) continue;
    const slug = link.href.split('?')[0].replace(/^\//, '');
    assert.equal(pageExists(slug), true, link.href);
  }
  assert.equal(MARKET_PAGES.length >= 12, true);
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
