import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { catalogs } from './i18n/catalog';
import { isRawNavKey, sidebarLabel, type SidebarLabelEntry } from './dashboard-nav-label';
import { showLearnerWelcomeBanner } from './onboarding-course';

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

interface ParsedItem extends SidebarLabelEntry {
  href: string;
  superOnly: boolean;
  contentOnly: boolean;
}

interface ParsedSection {
  key: string;
  label?: string;
}

const ROLES = ['student', 'teacher', 'parent', 'admin', 'institution_admin', 'partner_merchant'] as const;

function roleBlock(role: string): string {
  const start = layout.indexOf(`\n  ${role}: [`);
  const later = ROLES
    .map((name) => layout.indexOf(`\n  ${name}: [`))
    .filter((index) => index > start);
  const end = later.length > 0 ? Math.min(...later) : layout.indexOf('function isNavActive');
  return layout.slice(start, end);
}

function parseRole(role: string): { items: ParsedItem[]; sections: ParsedSection[] } {
  const items: ParsedItem[] = [];
  const sections: ParsedSection[] = [];
  let sectionKey: string | undefined;
  let sectionLabel: string | undefined;
  let recorded = false;
  for (const line of roleBlock(role).split('\n')) {
    if (line.includes('{ items: [') && !line.includes('sectionKey:')) {
      sectionKey = undefined;
      sectionLabel = undefined;
      recorded = false;
    }
    const section = /sectionKey: '([^']+)'(?:, sectionLabel: '([^']+)')?/.exec(line);
    if (section) {
      sectionKey = section[1];
      sectionLabel = section[2];
      recorded = false;
    }
    const href = /href: '([^']+)'/.exec(line);
    const key = /labelKey: '([^']+)'/.exec(line);
    if (!href || !key) continue;
    if (sectionKey && !recorded) {
      sections.push({ key: sectionKey, ...(sectionLabel ? { label: sectionLabel } : {}) });
      recorded = true;
    }
    const label = /label: '([^']*)'/.exec(line);
    items.push({
      href: href[1] ?? '',
      labelKey: key[1] ?? '',
      ...(label ? { label: label[1] } : {}),
      superOnly: line.includes('superOnly'),
      contentOnly: line.includes('contentOnly'),
    });
  }
  return { items, sections };
}

function sectionText(section: ParsedSection, language: string): string {
  if (section.label && language.startsWith('en')) return section.label;
  return translate(language, section.key);
}

test('every role has unique visible sidebar labels in English and Malay', () => {
  const views = [
    { name: 'student', role: 'student', superAdmin: false },
    { name: 'parent', role: 'parent', superAdmin: false },
    { name: 'teacher', role: 'teacher', superAdmin: false },
    { name: 'institution admin', role: 'institution_admin', superAdmin: false },
    { name: 'super admin', role: 'admin', superAdmin: true },
  ] as const;
  for (const view of views) {
    const parsed = parseRole(view.role);
    const items = parsed.items.filter((item) => (view.superAdmin || !item.superOnly) && (view.superAdmin || !item.contentOnly));
    if (view.role === 'teacher' || view.role === 'institution_admin') {
      items.unshift(
        { href: '/dashboard/admin/books', labelKey: 'nav.aiBookCreator', label: 'AI Book Creator', superOnly: false, contentOnly: false },
        { href: '/dashboard/admin/curriculum', labelKey: 'nav.curriculumCms', superOnly: false, contentOnly: false },
      );
    }
    const hrefs = items.map((item) => item.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `${view.name} lists a route twice`);
    for (const language of ['en', 'ms'] as const) {
      const labels = [
        ...parsed.sections.map((section) => sectionText(section, language)),
        ...items.map((item) => sidebarLabel(item, language, (key) => translate(language, key))),
      ].map((label) => label.trim().toLocaleLowerCase('en'));
      const seen = new Map<string, number>();
      for (const label of labels) seen.set(label, (seen.get(label) ?? 0) + 1);
      const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([label]) => label);
      assert.deepEqual(duplicates, [], `${view.name} ${language} duplicate labels: ${duplicates.join(', ')}`);
    }
  }
  assert.equal(translate('ms', 'nav.queues'), 'Barisan');
  assert.equal(translate('ms', 'nav.actionCentre'), 'Pusat tindakan');
  assert.equal(translate('ms', 'nav.timetabler'), 'ET AI Timetabler');
  assert.equal(translate('ms', 'nav.timetableStudio'), 'Timetabler');
  assert.equal(translate('ms', 'nav.safeLine'), 'Poket SafeLine');
  assert.equal(sidebarLabel({ labelKey: 'nav.timetableStudio', label: 'Timetabler' }, 'ms', (key) => translate('ms', key)), 'Timetabler');
  assert.notEqual(translate('ms', 'nav.references'), translate('ms', 'nav.referrals'));
});

test('learner welcome banners stay off admin and staff desks', () => {
  assert.equal(showLearnerWelcomeBanner('admin', 'independent'), false);
  assert.equal(showLearnerWelcomeBanner('teacher', 'student'), false);
  assert.equal(showLearnerWelcomeBanner('teacher', 'independent'), false);
  assert.equal(showLearnerWelcomeBanner('institution_admin', 'student'), false);
  assert.equal(showLearnerWelcomeBanner('teacher', 'teacher'), true);
  assert.equal(showLearnerWelcomeBanner('institution_admin', 'institution'), true);
  assert.equal(showLearnerWelcomeBanner('parent', 'parent'), true);
  assert.equal(showLearnerWelcomeBanner('student', 'independent'), true);
  assert.match(layout, /showLearnerWelcomeBanner|WelcomeResume role=/);
});
