import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTileOrder,
  DASH_CATEGORIES,
  DASH_ROLES,
  groupNotices,
  moveTile,
  pushCategoryForNotice,
  roleHome,
  searchLinks,
  sidebarGroups,
} from './home';
import { previewHome } from './preview';

test('every role has three tasks, four tabs, and a main action', () => {
  for (const role of DASH_ROLES) {
    const home = roleHome(role);
    assert.equal(home.tasks.length, 3, role);
    assert.equal(home.tabs.length, 4, role);
    assert.ok(home.fab.label.length > 0, role);
    assert.ok(home.fab.href.startsWith('/'), role);
  }
});

test('categories used on a home exist in the shared map', () => {
  for (const role of DASH_ROLES) {
    const home = roleHome(role);
    for (const item of [...home.tasks, ...home.tiles, ...home.tabs, home.fab]) {
      assert.ok(DASH_CATEGORIES.includes(item.category), `${role} ${item.id}`);
    }
  }
});

test('tile order keeps unknown ids out and appends new tiles', () => {
  const tiles = roleHome('student').tiles;
  const ordered = applyTileOrder(tiles, ['profile', 'missing', 'courses']);
  assert.equal(ordered[0]?.id, 'profile');
  assert.equal(ordered[1]?.id, 'courses');
  assert.equal(ordered.length, tiles.length);
  assert.equal(ordered.filter(tile => tile.id === 'profile').length, 1);
});

test('moving a tile stops at the ends', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(moveTile(ids, 'a', -1), ids);
  assert.deepEqual(moveTile(ids, 'b', 1), ['a', 'c', 'b']);
  assert.deepEqual(moveTile(ids, 'missing', 1), ids);
});

test('notices group by push category, with progress links first', () => {
  assert.equal(pushCategoryForNotice('grade'), 'grades');
  assert.equal(pushCategoryForNotice('general', '/dashboard/parent/progress'), 'progress');
  const groups = groupNotices([
    { type: 'grade', title: 'Marked' },
    { type: 'general', link: '/dashboard/teacher/progress', title: 'Alert' },
    { type: 'integrity', title: 'Review' },
  ]);
  assert.deepEqual(groups.map(group => group.category), ['progress', 'grades', 'flags']);
});

test('search finds a plain label and the sidebar has no duplicate href', () => {
  const hits = searchLinks('teacher', 'attendance');
  assert.ok(hits.some(hit => hit.id === 'attendance'));
  for (const role of DASH_ROLES) {
    const hrefs = sidebarGroups(role).flatMap(group => group.items.map(item => item.href));
    assert.equal(new Set(hrefs).size, hrefs.length, role);
  }
});

test('preview homes cover every role without a year label', () => {
  for (const role of DASH_ROLES) {
    const preview = previewHome(role);
    const text = JSON.stringify(preview);
    assert.equal(preview.stats.length >= 3, true, role);
    assert.equal(/year group/i.test(text), false, role);
    assert.equal(text.includes('Pocket'), false);
  }
});
