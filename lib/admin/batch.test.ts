import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { parseSeatAllocation } from './allocations';
import { builtinDesigns, normaliseDesign, paletteColours } from '../certificates/design';
import { certificatePdf } from '../certificates/pdf';
import { ROCHFORD_SCHOOL } from '../institutions/rochford';
import { bannerHref, itemInScope, summariseBanner, type BannerActor, type BannerItem } from '../safety/banner';
import { draftFromBody } from '../server/institution-create';

test('Rochford fixture is a flagged test school in Ipoh', () => {
  assert.equal(ROCHFORD_SCHOOL.test, true);
  assert.equal(ROCHFORD_SCHOOL.group, "Rochford's Education Group");
  assert.equal(ROCHFORD_SCHOOL.city, 'Ipoh');
  assert.equal(ROCHFORD_SCHOOL.state, 'Perak');
  assert.equal(ROCHFORD_SCHOOL.country, 'MY');
  assert.deepEqual([...ROCHFORD_SCHOOL.campuses], ['Falim', 'Ipoh Garden']);
  assert.equal(ROCHFORD_SCHOOL.website, 'https://www.edquest.edu.my');
  assert.match(ROCHFORD_SCHOOL.levels, /IGCSE/);
  const draft = draftFromBody({ fixture: 'rochford' }, 'admin-1');
  assert.equal(draft.ok, true);
  if (draft.ok) assert.equal(draft.value.slug, ROCHFORD_SCHOOL.slug);
});

test('seat allocation requires a target, seats, and dates', () => {
  const missing = parseSeatAllocation({});
  assert.equal(missing.ok, false);
  const ok = parseSeatAllocation({
    kind: 'course',
    courseId: 'maths',
    targetType: 'class',
    targetId: 'class-1',
    targetLabel: 'Year 10',
    seats: 30,
    startsOn: '2026-01-01',
    endsOn: '2026-12-01',
    institutionId: 'school-1',
  });
  assert.equal(ok.ok, true);
});

test('certificate palettes stay blue and cyan and the pdf names the title', async () => {
  const cyan = paletteColours('cyan');
  const blue = paletteColours('blue');
  assert.equal(cyan.ink, '#203337');
  assert.equal(cyan.line.toLowerCase(), '#3fe0d0');
  assert.equal(blue.accent, '#1E6A83');
  assert.notEqual(cyan.line.toLowerCase(), '#c8922a');
  assert.notEqual(cyan.line.toLowerCase(), '#c8820a');
  const design = normaliseDesign({ ...builtinDesigns()[0], title: 'Certificate of Achievement', isDefault: true });
  const regular = readFileSync('public/fonts/NotoSans-Regular.ttf');
  const bold = readFileSync('public/fonts/NotoSans-Bold.ttf');
  const bytes = await certificatePdf(design, {
    recipient: 'Amina Yusuf',
    course: 'IGCSE Mathematics',
    date: '18 Oct 2026',
    certificateId: 'PS-1042',
    verifyUrl: 'https://poketschool.ai/verify/PS-1042',
  }, { regular, bold });
  assert.ok(bytes.byteLength > 2000);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getTitle(), 'Certificate of Achievement');
  assert.equal(doc.getPageCount(), 1);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(width > height);
  assert.ok(Math.abs(width - 841.89) < 0.2);
  assert.equal(normaliseDesign({ institutionId: 'school-1', isDefault: true }).isDefault, false);
});

test('SafeLine banner is scoped and hidden from merchants', () => {
  const merchant: BannerActor = { uid: 'm', role: 'partner_merchant', staff: null, institutionId: '', region: '', country: '' };
  assert.equal(bannerHref(merchant), null);
  const school: BannerActor = { uid: 't', role: 'teacher', staff: null, institutionId: 'school-a', region: '', country: 'MY' };
  const item: BannerItem = { kind: 'hotline', institutionId: 'school-b', region: '', country: 'MY', parentUid: 'parent-1', dueAt: 1_000 };
  assert.equal(itemInScope(school, item), false);
  assert.equal(itemInScope({ ...school, institutionId: 'school-a' }, { ...item, institutionId: 'school-a' }), true);
  const parent: BannerActor = { uid: 'parent-1', role: 'parent', staff: null, institutionId: '', region: '', country: '' };
  assert.equal(itemInScope(parent, item), true);
  assert.equal(itemInScope(parent, { ...item, kind: 'emergency' }), false);
  const summary = summariseBanner([{ ...item, institutionId: 'school-a' }], '/dashboard/admin/hotline', 0);
  assert.equal(summary.show, true);
  assert.equal(summary.count, 1);
  assert.equal(summary.href, '/dashboard/admin/hotline');
});
