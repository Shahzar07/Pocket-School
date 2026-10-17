import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import {
  CLASSIC_TEMPLATES,
  COLOURFUL_TEMPLATES,
  applyCvFields,
  composeCv,
  cvDocumentPdf,
  cvNeedsTranslation,
  cvTranslatableFields,
  defaultCvDesign,
  moveSection,
  sanitizeDesignForItems,
  type CvDesign,
} from './cv-builder';
import { cvDocx } from './cv-docx';
import { sourceLabel, type RecordItem } from './portfolio';

function item(patch: Partial<RecordItem> & Pick<RecordItem, 'id' | 'source' | 'title'>): RecordItem {
  return {
    kind: patch.source === 'verified' ? 'institution' : 'volunteering',
    detail: '',
    when: '',
    verifyUrl: '',
    evidenceLink: '',
    section: patch.source === 'verified' ? 'education' : 'activities',
    ...patch,
  };
}

const verified = item({
  id: 'edu-north',
  source: 'verified',
  title: 'North Academy',
  detail: 'IGCSE',
  when: '2022-09-01 – 2024-06-01',
  section: 'education',
});

const score = item({
  id: 'score-maths',
  source: 'verified',
  kind: 'score',
  title: 'IGCSE Mathematics',
  detail: '86/100',
  section: 'scores',
});

const reported = item({
  id: 'self-library',
  source: 'self_reported',
  title: 'Library club',
  detail: 'Tuesday shelving',
  section: 'activities',
});

function design(patch: Partial<CvDesign> = {}): CvDesign {
  return {
    ...defaultCvDesign(),
    summary: 'Mathematics and a library club.',
    showScores: true,
    ...patch,
    wording: patch.wording ?? {
      'edu-north': { title: 'Fake Academy', detail: 'Invented level' },
      'self-library': { title: 'Saturday library club', detail: 'Front desk' },
    },
    customSections: patch.customSections ?? [{ id: 'custom-note', title: 'Availability', body: 'Ready for a 2027 start.' }],
    hiddenItems: patch.hiddenItems ?? [],
  };
}

test('a verified fact stays as recorded when a version tries to rewrite it', () => {
  const doc = composeCv({ name: 'Ada Lovelace', items: [verified, reported, score], design: design() });
  const lines = doc.sections.flatMap((section) => section.items.map((row) => `${row.title} ${row.detail} ${row.label}`)).join('\n');
  assert.equal(lines.includes('North Academy'), true);
  assert.equal(lines.includes('IGCSE'), true);
  assert.equal(lines.includes(sourceLabel('verified')), true);
  assert.equal(lines.includes('Fake Academy'), false);
  assert.equal(lines.includes('Invented level'), false);
  assert.equal(lines.includes('Saturday library club'), true);
  assert.equal(lines.includes('Front desk'), true);
  assert.equal(lines.includes('Library club'), false);
  const fields = cvTranslatableFields(doc);
  assert.equal(Object.values(fields).includes('North Academy'), false);
  assert.equal(fields['t:self-library'], 'Saturday library club');
  const translated = applyCvFields(doc, { 't:edu-north': 'Still fake', 'h:education': 'Studies', 't:self-library': 'Kelab perpustakaan' });
  const education = translated.sections.find((section) => section.id === 'education');
  assert.equal(education?.title, 'Studies');
  assert.equal(education?.items[0]?.title, 'North Academy');
  const activity = translated.sections.flatMap((section) => section.items).find((row) => row.id === 'self-library');
  assert.equal(activity?.title, 'Kelab perpustakaan');
});

test('hidden sections, hidden scores, and custom sections follow the version', () => {
  const hidden = composeCv({
    name: 'Ada Lovelace',
    items: [verified, score],
    design: design({ hiddenItems: ['score-maths'], hiddenSections: ['education'], showScores: true }),
  });
  const text = hidden.sections.flatMap((section) => [section.title, section.body, ...section.items.map((row) => row.title)]).join('\n');
  assert.equal(text.includes('North Academy'), false);
  assert.equal(text.includes('86/100'), false);
  assert.equal(text.includes('Availability'), true);
  assert.equal(text.includes('Ready for a 2027 start.'), true);
  const withoutScores = composeCv({
    name: 'Ada Lovelace',
    items: [score],
    design: design({ showScores: false, customSections: [] }),
  });
  assert.equal(withoutScores.sections.some((section) => section.id === 'scores'), false);
  const order = moveSection(['summary', 'education', 'custom-note'], 'custom-note', 0);
  assert.equal(order[0], 'custom-note');
});

test('saved wording for a verified line is removed before the version is stored', () => {
  const clean = sanitizeDesignForItems(design(), [verified, reported]);
  assert.equal(clean.wording['edu-north'], undefined);
  assert.equal(clean.wording['self-library']?.title, 'Saturday library club');
});

test('classic and colourful templates, page size, and photo are export choices', () => {
  assert.equal(CLASSIC_TEMPLATES.length >= 3, true);
  assert.equal(COLOURFUL_TEMPLATES.length >= 4, true);
  assert.equal(cvNeedsTranslation('en'), false);
  assert.equal(cvNeedsTranslation('ms'), true);
  assert.equal(cvNeedsTranslation('made-up'), false);
  const a4 = new TextDecoder().decode(cvDocumentPdf(composeCv({
    name: 'Ada Lovelace',
    items: [verified],
    design: design({ template: 'deep', pageSize: 'A4', font: 'serif', photo: true, layout: 'two' }),
  })));
  assert.equal(a4.startsWith('%PDF-1.4'), true);
  assert.equal(a4.includes('MediaBox [0 0 595 842]'), true);
  assert.equal(a4.includes('/Times-Roman'), true);
  assert.equal(a4.includes('North Academy'), true);
  assert.equal(a4.includes('Fake Academy'), false);
  assert.equal(a4.includes('36 36 re f'), true);
  const letter = new TextDecoder().decode(cvDocumentPdf(composeCv({
    name: 'Ada Lovelace',
    items: [verified],
    design: design({ template: 'classic', pageSize: 'Letter', font: 'mono', photo: false }),
  })));
  assert.equal(letter.includes('MediaBox [0 0 612 792]'), true);
  assert.equal(letter.includes('/Courier'), true);
  assert.equal(letter.includes('36 36 re f'), false);
});

test('the DOCX zip keeps verified facts and drops a hidden line', async () => {
  const bytes = await cvDocx(composeCv({
    name: 'Ada Lovelace',
    items: [verified, score],
    design: design({ hiddenItems: ['score-maths'], pageSize: 'A4', layout: 'two', font: 'serif' }),
  }));
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml')?.async('string');
  assert.equal(typeof xml, 'string');
  assert.equal(xml?.includes('North Academy'), true);
  assert.equal(xml?.includes('Verified by Poket School'), true);
  assert.equal(xml?.includes('Fake Academy'), false);
  assert.equal(xml?.includes('86/100'), false);
  assert.equal(xml?.includes('Availability'), true);
  assert.equal(xml?.includes('w:w="11906"'), true);
  assert.equal(xml?.includes('w:num="2"'), true);
  assert.equal(xml?.includes('Times New Roman'), true);
});
