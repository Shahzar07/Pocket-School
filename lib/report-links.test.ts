import assert from 'node:assert/strict';
import test from 'node:test';
import { moderationPrompt, reportLinks } from './report-links';

test('reports link attendance, analytics, and behaviour', () => {
  const student = reportLinks('student').map((link) => link.href);
  assert.ok(student.includes('/dashboard/student/attendance'));
  assert.ok(student.includes('/dashboard/behaviour'));
  const admin = reportLinks('admin').map((link) => link.label);
  assert.ok(admin.includes('Moderation'));
  const prompt = moderationPrompt('hello', 'community');
  assert.match(prompt, /ET AI/);
  assert.match(prompt, /person will confirm/);
});
