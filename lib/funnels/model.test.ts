import assert from 'node:assert/strict';
import test from 'node:test';
import { FUNNEL_COPY } from './copy';
import {
  funnelAdminAllowed,
  funnelDeskAllowed,
  nextCopySlug,
  normalizeSlug,
  templateSections,
  validLeadEmail,
  validSlug,
} from './model';

test('slugs stay short, lowercase, and hyphenated', () => {
  assert.equal(validSlug('igcse-open-evening'), true);
  assert.equal(validSlug('A'), false);
  assert.equal(validSlug('ps-1042'), true);
  assert.equal(validSlug('-nope'), false);
  assert.equal(validSlug('has--gap'), false);
  assert.equal(normalizeSlug('  IGCSE Open Evening! '), 'igcse-open-evening');
});

test('a duplicate slug grows a suffix that is still free', () => {
  const taken = new Set(['open-evening', 'open-evening-copy']);
  assert.equal(nextCopySlug('open-evening', taken), 'open-evening-2');
  assert.equal(nextCopySlug('', new Set()), 'page-copy');
});

test('templates include the requested sections and no invented testimonial', () => {
  const course = templateSections('course');
  assert.deepEqual(course.map((section) => section.kind), ['hero', 'benefits', 'pricing', 'testimonials', 'faq', 'cta']);
  const quotes = course.find((section) => section.kind === 'testimonials');
  assert.equal(quotes?.items.length, 0);
  const prices = course.find((section) => section.kind === 'pricing')?.items.map((item) => item.price);
  assert.deepEqual(prices, ['$0', '$49', '$79', '$99', '$19']);
  assert.equal(templateSections('blank').map((section) => section.kind).join(','), 'hero,cta');
  assert.equal(templateSections('school').some((section) => section.kind === 'pricing'), false);
  assert.match(FUNNEL_COPY.quotePlaceholder, /agrees to be named/);
  assert.doesNotMatch(JSON.stringify(course), /Amina|★★|gold/i);
});

test('lead emails need a real address shape', () => {
  assert.equal(validLeadEmail('ada@poketschool.ai'), true);
  assert.equal(validLeadEmail('not-an-email'), false);
  assert.equal(validLeadEmail(''), false);
});

test('funnel admin access stays with platform admins', () => {
  assert.equal(funnelDeskAllowed({ role: 'admin', email: 'ada@poketschool.ai', adminRole: 'admin' }), true);
  assert.equal(funnelDeskAllowed({ role: 'admin', adminRole: 'super_admin' }), true);
  assert.equal(funnelDeskAllowed({ role: 'admin' }), true);
  assert.equal(funnelDeskAllowed({ role: 'admin', adminRole: 'support' }), false);
  assert.equal(funnelDeskAllowed({ role: 'admin', adminRole: 'finance' }), false);
  assert.equal(funnelDeskAllowed({ role: 'admin', adminRole: 'content_editor' }), false);
  assert.equal(funnelDeskAllowed({ role: 'student' }), false);
  assert.equal(funnelDeskAllowed({ role: 'teacher' }), false);
  assert.equal(funnelDeskAllowed({ role: 'parent' }), false);
  assert.equal(funnelDeskAllowed({ role: 'institution_admin' }), false);
  assert.equal(funnelAdminAllowed({ tokenRole: 'student', profileRole: 'admin' }), false);
  assert.equal(funnelAdminAllowed({ profileRole: 'admin', profileAdminRole: 'support' }), false);
  assert.equal(funnelAdminAllowed({ profileRole: 'admin', profileAdminRole: 'super_admin' }), true);
  assert.equal(funnelAdminAllowed({ email: 'harry@poketschool.ai', tokenRole: 'student' }), true);
});
