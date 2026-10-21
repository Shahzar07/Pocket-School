import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blockPalette } from './block-palette';
import { teacherMustSignCopyright } from '../courses/copyright';
import { BUZAN_COLORS, parseBuzan } from '../mindmap';
import { parseInfographic } from '../../components/infographic-renderer';
import { crumbLabel, setCrumbTitle } from '../shell/crumb-titles';

test('teachers sign once per course and other roles do not', () => {
  assert.equal(teacherMustSignCopyright('teacher', ''), true);
  assert.equal(teacherMustSignCopyright('teacher', 'sig-1'), false);
  assert.equal(teacherMustSignCopyright('admin', ''), false);
  assert.equal(teacherMustSignCopyright('student', ''), false);
  assert.equal(teacherMustSignCopyright('institution_admin', ''), false);
});

test('the add-a-block grid has one control per block', () => {
  const defs = blockPalette().flatMap(group => group.defs);
  const ids = defs.map(def => def.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.filter(id => id === 'image').length, 1);
  assert.equal(ids.filter(id => id === 'illustration').length, 1);
  const labels = defs.map(def => def.label);
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(labels.includes('Infographic'));
  assert.ok(labels.includes('Infographic image'));
  assert.deepEqual(blockPalette().map(group => group.group), ['Lesson', 'Practice', 'Visual']);
});

test('Buzan branches stay in the blue and cyan family', () => {
  const banned = ['#f0a202', '#c8820a', '#e23b3b', '#7048e8', '#e8590c', '#d6336c'];
  for (const color of BUZAN_COLORS) {
    assert.equal(banned.includes(color.toLowerCase()), false, color);
    const hex = color.slice(1);
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    assert.ok(blue >= red && blue >= green - 40, color);
  }
});

test('a Buzan map and an infographic render only what the lesson wrote', () => {
  const map = parseBuzan(`{"center":"Cells","branches":[{"keyword":"Nucleus"},{"keyword":"Wall"}]}`);
  assert.equal(map?.center, 'Cells');
  assert.equal(map?.branches.length, 2);
  const info = parseInfographic('# Plant cell\n\n## Parts\n\n- Nucleus\n- Cell wall\n');
  assert.equal(info.title, 'Plant cell');
  assert.equal(info.stats.length, 0);
});

test('a course title replaces the id in the breadcrumb', () => {
  setCrumbTitle('course-abc', 'Cells and tissues');
  assert.equal(crumbLabel('course-abc'), 'Cells and tissues');
  assert.equal(crumbLabel('other'), undefined);
});
