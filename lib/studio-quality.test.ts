import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { layoutBuzan, parseBuzan } from './mindmap';
import { groundInfographic, problemsAreWorked, statGrounded } from './generation-quality';
import { visibleJob } from './generation-jobs';
import { canDownload } from './export/allow';
import { copyrightNotice } from './export/notice';
import { buildExport } from './export/files';
import { problemsForExport } from './export/payload';

const STUDY_NOTES = '## Introduction\n\nA note.\n\n## Core explanation\n\nMore.';

test('a Buzan map keeps one keyword, a curve, a colour, and a thinner child', () => {
  const map = parseBuzan(JSON.stringify({
    center: 'Revenue growth',
    branches: [
      { keyword: 'Price', icon: '💡', children: [{ keyword: 'Cost', children: [] }] },
      { keyword: 'Demand', children: [] },
      { keyword: 'Supply', children: [] },
      { keyword: 'Market', children: [] },
      { keyword: 'Brand', children: [] },
      { keyword: 'Scale', children: [] },
    ],
  }));
  assert.ok(map);
  assert.equal(map.center, 'Revenue');
  assert.equal(map.branches[0].keyword, 'Price');
  const layout = layoutBuzan(map);
  const mains = layout.ribbons.filter(ribbon => ribbon.depth === 0);
  const child = layout.ribbons.find(ribbon => ribbon.depth === 1);
  assert.equal(new Set(mains.map(ribbon => ribbon.color)).size, 6);
  assert.ok(child);
  assert.ok(child.startWidth < mains[0].startWidth);
  assert.equal(mains[0].curved, true);
});

test('study-note prose is not a mind map or a worked problem', () => {
  assert.equal(parseBuzan(STUDY_NOTES), null);
  assert.equal(problemsAreWorked(STUDY_NOTES), false);
  assert.equal(problemsAreWorked('## Problem 1\nFind the revenue.\n\n### Worked solution\nMultiply price by quantity.'), true);
});

test('infographic figures must match the lesson number and its label', () => {
  const revenue = 'Total revenue for the year was £4 million from the shop.';
  assert.equal(statGrounded('£4 million', 'app revenue', revenue), false);
  assert.equal(statGrounded('£4 million', 'total revenue', revenue), true);
  assert.equal(statGrounded('2M', 'sign-ups', 'The campaign reached 2M people online.'), false);
  assert.equal(statGrounded('2M', 'sign-ups', 'The campaign reached 2M sign-ups.'), true);
  assert.equal(statGrounded('8%', 'impact', 'Sales grew after the launch.'), false);

  const grounded = groundInfographic([
    '# Finance',
    '**£4 million** — app revenue',
    '**2M** — sign-ups',
    '**8%** — impact',
    '**£4 million** — total revenue',
  ].join('\n'), `${revenue}\nThe campaign reached 2M people online.`);
  assert.deepEqual(grounded.rejected, [
    '£4 million — app revenue',
    '2M — sign-ups',
    '8% — impact',
  ]);
  assert.match(grounded.markdown, /total revenue/);
  assert.doesNotMatch(grounded.markdown, /app revenue/);
});

test('downloads follow role, tier, allocation, and the product switch', () => {
  assert.equal(canDownload({ role: 'admin', downloadsEnabled: false }).allowed, true);
  assert.equal(canDownload({ role: 'teacher' }).allowed, true);
  assert.equal(canDownload({ role: 'teacher', downloadsEnabled: false }).allowed, false);
  assert.equal(canDownload({ role: 'institution_admin' }).allowed, true);
  assert.equal(canDownload({ role: 'student', tier: 0, courseId: 'c1' }).allowed, false);
  assert.equal(canDownload({ role: 'student', tier: 1, courseId: 'c1' }).allowed, true);
  assert.equal(canDownload({ role: 'student', tier: 0, courseId: 'c1', permissions: ['alloc:paid:c1'] }).allowed, true);
  assert.equal(canDownload({ role: 'student', tier: 0, courseId: 'c1', downloadsEnabled: true }).allowed, true);
  assert.equal(canDownload({ role: 'student', tier: 2, downloadsEnabled: false }).allowed, false);
});

test('a generator that stalls is shown as failed', () => {
  const now = Date.now();
  const job = visibleJob({ status: 'generating', updatedAt: now - 4 * 60 * 1000 }, now);
  assert.equal(job?.status, 'failed');
  assert.match(job?.error ?? '', /stopped/);
});

test('the copyright notice names Poket Media', () => {
  assert.equal(copyrightNotice(2026), '© 2026 Poket Media Sdn Bhd (1332289-X). All rights reserved.');
});

test('an export hides the worked solution and carries the notice', async () => {
  const hidden = problemsForExport('## Problem 1\nFind it.\n\n### Worked solution\nThe answer is 4.\n\n## Problem 2\nNext.', false);
  assert.doesNotMatch(hidden, /Worked solution/);
  assert.match(hidden, /Problem 2/);

  const pdf = await buildExport({
    asset: 'notes',
    format: 'pdf',
    title: 'Revenue',
    content: 'Total revenue was £4 million.',
    answerKey: true,
  });
  assert.match(pdf.bytes.toString('latin1'), /\\251 2026 Poket Media Sdn Bhd/);

  const docx = await buildExport({
    asset: 'problems',
    format: 'docx',
    title: 'Problems',
    content: '## Problem 1\nFind it.\n\n### Worked solution\nThe answer is 4.',
    answerKey: false,
  });
  const zip = await JSZip.loadAsync(docx.bytes);
  const footer = await zip.file('word/footer1.xml')?.async('string');
  const document = await zip.file('word/document.xml')?.async('string');
  assert.match(footer ?? '', /Poket Media Sdn Bhd/);
  assert.match(footer ?? '', /Poket School/);
  assert.doesNotMatch(document ?? '', /Worked solution/);

  const png = await buildExport({
    asset: 'mindmap',
    format: 'png',
    title: 'Map',
    content: JSON.stringify({
      center: 'Trade',
      branches: [
        { keyword: 'Price', children: [] },
        { keyword: 'Cost', children: [] },
      ],
    }),
    answerKey: true,
  });
  assert.equal(png.contentType, 'image/png');
  assert.equal(png.bytes.subarray(0, 4).toString('hex'), '89504e47');
});
