import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { DASHBOARD_PAGES, pageForPath, renderAuditMarkdown } from './dashboard-pages';

const root = fileURLToPath(new URL('..', import.meta.url));

function pageRoutes(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...pageRoutes(full));
    else if (name === 'page.tsx') {
      const route = `/${relative(join(root, 'app'), full).replace(/\\/g, '/').replace(/\/page\.tsx$/, '')}`;
      found.push(route);
    }
  }
  return found;
}

test('every dashboard page is in the audit registry', () => {
  const routes = pageRoutes(join(root, 'app/dashboard'));
  const known = new Set(DASHBOARD_PAGES.map((page) => page.path));
  const missing = routes.filter((route) => !known.has(route));
  assert.deepEqual(missing, []);
  assert.ok(routes.length >= 100);
});

test('dynamic routes resolve to the longest page purpose', () => {
  const lesson = pageForPath('/dashboard/student/courses/abc/lessons/def');
  assert.equal(lesson?.path, '/dashboard/student/courses/[courseId]/lessons/[lessonId]');
  assert.match(lesson?.purpose ?? '', /lesson/i);
  assert.equal(pageForPath('/dashboard/student/tasks')?.title, 'Daily goals');
});

test('audit doc records the merge decisions and owner keys', () => {
  const doc = readFileSync(join(root, 'docs/DASHBOARD_AUDIT.md'), 'utf8');
  assert.equal(doc.trim(), renderAuditMarkdown().trim());
  for (const phrase of [
    'Users & Sparks is the directory',
    'daily-goals',
    'Google Calendar',
    'OPENROUTER_API_KEY',
    'SMTP_PASS',
    'Channels fold in',
    'Snap',
  ]) {
    assert.match(doc, new RegExp(phrase));
  }
});
