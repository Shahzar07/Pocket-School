import assert from 'node:assert/strict';
import test from 'node:test';
import { FOOTER_COLUMNS, FOOTER_LEGAL, HEADER_DESTINATIONS } from './footer-columns';

test('footer columns stay short and keep the old destinations', () => {
  const hrefs = new Set(FOOTER_COLUMNS.flatMap((column) => column.links.map((link) => link.href.split('?')[0])));
  for (const column of FOOTER_COLUMNS) {
    assert.ok(column.links.length >= 5 && column.links.length <= 7, column.id);
  }
  const schoolLinks = FOOTER_COLUMNS.flatMap((column) => column.links).filter((link) => link.href.startsWith('/institutions'));
  assert.equal(schoolLinks.length, 1);
  assert.equal(schoolLinks[0]?.href, '/institutions/register');
  assert.equal(FOOTER_COLUMNS.some((column) => column.links.some((link) => link.href === '/privacy' || link.href === '/terms')), false);
  for (const href of HEADER_DESTINATIONS) {
    if (href === '/') continue;
    assert.equal(hrefs.has(href), true, href);
  }
  assert.deepEqual(FOOTER_LEGAL.map((link) => link.href), ['/privacy', '/terms', '/legal?doc=cookies', '/legal?doc=aup']);
});
