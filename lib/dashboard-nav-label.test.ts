import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { catalogs } from './i18n/catalog';
import { isRawNavKey, sidebarLabel, type SidebarLabelEntry } from './dashboard-nav-label';

const layout = readFileSync(new URL('../app/dashboard/layout.tsx', import.meta.url), 'utf8');

function entries(): SidebarLabelEntry[] {
  const found: SidebarLabelEntry[] = [];
  for (const match of layout.matchAll(/\{ href: '([^']+)'[^}]*labelKey: '([^']+)'([^}]*)\}/g)) {
    const label = /label: '([^']*)'/.exec(match[3] ?? '');
    found.push({ labelKey: match[2] ?? '', ...(label ? { label: label[1] } : {}) });
  }
  return found;
}

function translate(language: string, key: string): string {
  const catalog = catalogs[language as keyof typeof catalogs] as unknown as Record<string, unknown>;
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (!node || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, catalog);
  return typeof value === 'string' ? value : key;
}

test('the sidebar uses the shared label resolver', () => {
  assert.match(layout, /sidebarLabel\(entry, language, t\)/);
  assert.ok(entries().length > 40);
});

test('no sidebar entry renders a raw nav. key in any locale', () => {
  const nav = entries();
  assert.ok(nav.some((entry) => entry.labelKey === 'nav.notes'));
  assert.ok(nav.some((entry) => entry.labelKey === 'nav.perks'));
  for (const language of Object.keys(catalogs)) {
    for (const entry of nav) {
      const label = sidebarLabel(entry, language, (key) => translate(language, key));
      assert.equal(isRawNavKey(label), false, `${language} ${entry.labelKey} rendered ${label}`);
      assert.notEqual(label, entry.labelKey, `${language} ${entry.labelKey}`);
    }
  }
});

test('perks and marketplace stay separate routes with different Malay labels', () => {
  assert.match(layout, /href: '\/dashboard\/student\/perks'[^}]*labelKey: 'nav.perks'/);
  assert.match(layout, /href: '\/courses'[^}]*labelKey: 'nav.marketplace'/);
  const perks = sidebarLabel({ labelKey: 'nav.perks', label: 'Perks' }, 'ms', (key) => translate('ms', key));
  const market = sidebarLabel({ labelKey: 'nav.marketplace' }, 'ms', (key) => translate('ms', key));
  assert.equal(perks, 'Faedah');
  assert.equal(market, 'Pasaran');
  assert.notEqual(perks, market);
  assert.equal(translate('ms', 'nav.notes'), 'Nota');
  assert.equal(translate('ms', 'nav.aiStudio'), 'AI Studio');
  assert.equal(translate('en', 'nav.aiStudio'), 'AI Studio');
});
