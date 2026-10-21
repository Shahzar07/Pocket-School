import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
  builtinDesigns,
  designFieldErrors,
  imageFieldError,
  imageSource,
  normaliseDesign,
  scopeDesignForActor,
  templateSampleRecord,
  uniqueDesigns,
} from './design';
import { certificateLayout } from './layout';
import { certificatePdf } from './pdf';
import { decorateSample, designForIssue, isSampleImage } from './sample-placeholders';

test('builtin templates do not share signatories and tabs are not both named New template', () => {
  const [cyan, blue] = builtinDesigns();
  assert.ok(cyan && blue);
  cyan.signatories[0]!.name = 'Changed';
  assert.equal(blue.signatories[0]?.name, 'Poket School');
  assert.equal(builtinDesigns().some((item) => item.name === 'New template'), false);
  const doubled = uniqueDesigns([cyan, { ...blue, id: cyan.id }]);
  assert.equal(doubled.length, 1);
});

test('image fields accept https and small uploads, and reject anything else', () => {
  const png = `data:image/png;base64,${'A'.repeat(40)}`;
  assert.equal(imageSource(png), png);
  assert.equal(imageFieldError(png), '');
  assert.equal(imageSource('http://example.com/logo.png'), '');
  assert.match(imageFieldError('http://example.com/logo.png'), /https/);
  assert.equal(imageSource('not a url'), '');
  assert.equal(imageSource(`data:image/png;base64,${'A'.repeat(130_000)}`), '');
  const design = normaliseDesign({
    logoUrl: 'https://cdn.example.com/logo.png',
    coBrandLogoUrl: png,
    signatories: [{ name: 'Ada', title: 'Head', imageUrl: 'javascript:alert(1)' }],
  });
  assert.equal(design.logoUrl, 'https://cdn.example.com/logo.png');
  assert.equal(design.coBrandLogoUrl, png);
  assert.equal(design.signatories[0]?.imageUrl, '');
  assert.equal(design.pageSize, 'a4-landscape');
  assert.equal(designFieldErrors({ ...design, logoUrl: 'ftp://files.example/a.png' })[0]?.includes('https'), true);
});

test('an institution admin cannot set the platform default', () => {
  const design = normaliseDesign({ ...builtinDesigns()[0], isDefault: true, name: 'School cyan' });
  const scoped = scopeDesignForActor(design, { staff: 'institution_admin', institutionId: 'school-9' });
  assert.equal(scoped.isDefault, false);
  assert.equal(scoped.institutionId, 'school-9');
  assert.equal(scoped.id, 'institution-school-9');
  const platform = scopeDesignForActor(design, { staff: 'super_admin', institutionId: '' });
  assert.equal(platform.isDefault, true);
  assert.equal(platform.id, 'poket-cyan');
});

test('the template sample id resolves and other ids do not', () => {
  const sample = templateSampleRecord('PS-1042');
  assert.equal(sample?.studentName, 'Amina Yusuf');
  assert.equal(sample?.sample, true);
  assert.equal(templateSampleRecord('PS-9999'), null);
});

test('every page size keeps the QR, URL, and copyright inside the sheet', () => {
  for (const pageSize of ['a4-landscape', 'a4-portrait', 'letter'] as const) {
    const design = normaliseDesign({
      ...builtinDesigns()[0],
      pageSize,
      coBrandName: 'North Academy',
      signatories: [
        { name: 'Poket School', title: 'Issuer', imageUrl: '' },
        { name: 'North Academy', title: 'Partner', imageUrl: '' },
      ],
    });
    const layout = certificateLayout(design);
    const boxes = [
      layout.outer, layout.band, layout.mark, layout.title, layout.qr, layout.verify, layout.copyright,
      ...layout.signatories,
    ];
    for (const item of boxes) {
      assert.ok(item.x >= -0.01, pageSize);
      assert.ok(item.y >= -0.01, pageSize);
      assert.ok(item.x + item.w <= layout.page.width + 0.6, pageSize);
      assert.ok(item.y + item.h <= layout.page.height + 0.6, pageSize);
    }
    assert.ok(layout.verify.y + layout.verify.h <= layout.copyright.y + 0.6);
    for (const signatory of layout.signatories) {
      assert.ok(signatory.x + signatory.w <= layout.qr.x + 0.6);
    }
    if (pageSize === 'a4-portrait') assert.ok(layout.page.height > layout.page.width);
    else assert.ok(layout.page.width > layout.page.height);
  }
});

test('placeholder art stays on the labelled sample and is stripped before issue', async () => {
  const blank = builtinDesigns()[0];
  assert.ok(blank);
  const sample = decorateSample(blank);
  assert.equal(sample.coBrandName, 'Harbour');
  assert.equal(isSampleImage(sample.logoUrl), true);
  assert.equal(isSampleImage(sample.coBrandLogoUrl), true);
  assert.equal(isSampleImage(sample.signatories[0]?.imageUrl), true);
  const issued = designForIssue(sample);
  assert.equal(issued.coBrandName, '');
  assert.equal(issued.logoUrl, '');
  assert.equal(issued.coBrandLogoUrl, '');
  assert.equal(issued.signatories[0]?.imageUrl, '');
  const saved = normaliseDesign(sample);
  assert.equal(saved.coBrandName, '');
  assert.equal(saved.logoUrl, '');
  assert.equal(saved.signatories[0]?.imageUrl, '');
  const real = designForIssue(normaliseDesign({
    ...blank,
    coBrandName: 'Harbour',
    coBrandLogoUrl: 'https://cdn.example/harbour.png',
  }));
  assert.equal(real.coBrandName, 'Harbour');
  assert.equal(real.coBrandLogoUrl, 'https://cdn.example/harbour.png');

  const regular = readFileSync('public/fonts/NotoSans-Regular.ttf');
  const bold = readFileSync('public/fonts/NotoSans-Bold.ttf');
  const facts = {
    recipient: 'Amina Yusuf',
    course: 'IGCSE Mathematics',
    date: '18 Oct 2026',
    certificateId: 'PS-1042',
    verifyUrl: 'https://poketschool.ai/verify/PS-1042',
  };
  const fonts = { regular, bold };
  const sampleAssets = {
    logo: Uint8Array.from(Buffer.from(sample.logoUrl.split(',')[1] ?? '', 'base64')),
    coBrand: Uint8Array.from(Buffer.from(sample.coBrandLogoUrl.split(',')[1] ?? '', 'base64')),
    signatures: [Uint8Array.from(Buffer.from(sample.signatories[0]?.imageUrl.split(',')[1] ?? '', 'base64'))],
  };
  const preview = await certificatePdf(blank, facts, { ...fonts, labelledSample: true, assets: sampleAssets });
  const awarded = await certificatePdf(sample, facts, { ...fonts, labelledSample: false, assets: sampleAssets });
  const previewDoc = await PDFDocument.load(preview);
  const awardedDoc = await PDFDocument.load(awarded);
  assert.match(previewDoc.getSubject() ?? '', /Template sample/);
  assert.doesNotMatch(awardedDoc.getSubject() ?? '', /Template sample/);
  const previewImages = Buffer.from(preview).toString('latin1').match(/\/Subtype \/Image/g)?.length ?? 0;
  const awardedImages = Buffer.from(awarded).toString('latin1').match(/\/Subtype \/Image/g)?.length ?? 0;
  assert.ok(previewImages > awardedImages);
  assert.equal(awardedImages, 1);
});

test('the pdf matches the landscape sheet and embeds a font, border, and verify link', async () => {
  const regular = readFileSync('public/fonts/NotoSans-Regular.ttf');
  const bold = readFileSync('public/fonts/NotoSans-Bold.ttf');
  const png = Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ));
  const design = normaliseDesign({
    ...builtinDesigns()[0],
    title: 'Certificate of Achievement',
    logoUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}`,
    coBrandName: 'North Academy',
    coBrandLogoUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}`,
    signatories: [{ name: 'Poket School', title: 'Issuer', imageUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}` }],
  });
  const bytes = await certificatePdf(design, {
    recipient: 'Amina Yusuf',
    course: 'IGCSE Mathematics',
    date: '18 Oct 2026',
    certificateId: 'PS-1042',
    verifyUrl: 'https://poketschool.ai/verify/PS-1042',
  }, {
    regular,
    bold,
    assets: { logo: png, coBrand: png, signatures: [png] },
  });
  const raw = Buffer.from(bytes).toString('latin1');
  assert.match(raw, /%PDF-1/);
  assert.match(raw, /NotoSans/);
  assert.match(raw, /poketschool\.ai\/verify\/PS-1042/);
  assert.doesNotMatch(raw, /C8820A/i);
  assert.doesNotMatch(raw, /F0A202/i);
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  assert.equal(doc.getTitle(), 'Certificate of Achievement');
  assert.equal(doc.getAuthor(), 'Poket School');
  const { width, height } = page.getSize();
  assert.ok(Math.abs(width - 841.89) < 0.2);
  assert.ok(height < width);
  assert.match(raw, /\/Subtype \/Image/);
});
