import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moduleHomeHref, showsModuleHeader } from './module-header';

test('home follows whether someone is signed in', () => {
  assert.equal(moduleHomeHref(false), '/');
  assert.equal(moduleHomeHref(true), '/dashboard');
});

test('standalone modules show the shared header', () => {
  for (const path of [
    '/reads',
    '/reads/studio',
    '/reads/read/book-1',
    '/ai-studio',
    '/ai-teachers',
    '/ai-teachers/et-english/session',
    '/preview/course/sample',
    '/preview/goals',
    '/teacher-studio',
    '/a/kolej-utama',
    '/studio/essays',
  ]) {
    assert.equal(showsModuleHeader(path), true, path);
  }
});

test('pages that already have site or dashboard navigation stay clear', () => {
  for (const path of ['/', '/courses', '/pricing', '/dashboard', '/dashboard/student', '/login', '/admin/login', '/a/kolej-utama/login', '/i/north/login']) {
    assert.equal(showsModuleHeader(path), false, path);
  }
});
