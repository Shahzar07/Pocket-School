import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { errorsToCsv, parseManifest, pendingSkus, reportRows, type FileEntry } from './manifest';
import { SAMPLE_MANIFEST } from './sample';
import { IMAGE_MAX_BYTES, PDF_MAX_BYTES } from './paths';

function filesFor(csv: string, size = 100): FileEntry[] {
  const { rows } = parseManifest(csv);
  const paths = new Set<string>();
  rows.forEach(row => {
    [row.paperPdf, row.markschemePdf, row.thumbnail, ...row.previewImages].forEach(path => {
      if (path) paths.add(path);
    });
  });
  return [...paths].map(path => ({ path, bytes: size }));
}

describe('store manifest', () => {
  it('accepts the two-row sample and keeps every product a draft', () => {
    const parsed = parseManifest(SAMPLE_MANIFEST);
    assert.equal(parsed.headerError, '');
    assert.equal(parsed.rows.length, 2);
    const reports = reportRows(parsed.rows, filesFor(SAMPLE_MANIFEST), new Set(['PS-4BI1-F-N1']));
    assert.equal(reports.every(row => row.ok), true);
    assert.equal(reports[0]?.action, 'create');
    assert.equal(reports[1]?.action, 'update');
    assert.equal(reports[0]?.warnings.length, 0);
    assert.deepEqual(parsed.rows[0]?.tags, ['maths', 'paper']);
    assert.deepEqual(parsed.rows[0]?.previewImages, ['PS-4MA1-H-P1/preview-1.png', 'PS-4MA1-H-P1/preview-2.png']);
    assert.equal(parsed.rows[0]?.level, 'Higher');
  });

  it('reports missing files, bad prices, duplicate SKUs, year numbers, and oversized files', () => {
    const csv = `sku,title,subject,level,exam_board,spec_code,type,price_usd,price_myr,access,description,tags,paper_pdf,markscheme_pdf,thumbnail,preview_images,status
PS-1,Paper,Mathematics,Year 10,Pearson,4MA1,paper,9.00,39.00,paid,Notes,,PS-1/paper.pdf,PS-1/paper.pdf,PS-1/thumb.png,,draft
PS-1,Paper,Mathematics,2024,Pearson,4MA1,paper,nope,-1,paid,Notes,,PS-1/missing.pdf,PS-1/scheme.pdf,PS-1/thumb.jpg,,published
PS-2,Paper,Mathematics,10,Pearson,4MA1,paper,0.00,0.00,paid,Notes,,PS-2/paper.pdf,PS-2/scheme.pdf,PS-2/thumb.png,,draft
`;
    const parsed = parseManifest(csv);
    const files: FileEntry[] = [
      { path: 'PS-1/paper.pdf', bytes: 100 },
      { path: 'PS-1/thumb.png', bytes: 100 },
      { path: 'PS-2/paper.pdf', bytes: PDF_MAX_BYTES + 1 },
      { path: 'PS-2/scheme.pdf', bytes: 100 },
      { path: 'PS-2/thumb.png', bytes: IMAGE_MAX_BYTES + 1 },
    ];
    const reports = reportRows(parsed.rows, files, new Set());
    assert.match(reports[0]?.errors.join(' ') ?? '', /year number/);
    assert.match(reports[0]?.errors.join(' ') ?? '', /separate files/);
    assert.match(reports[1]?.errors.join(' ') ?? '', /duplicate SKU/);
    assert.match(reports[1]?.errors.join(' ') ?? '', /bad price/);
    assert.match(reports[1]?.errors.join(' ') ?? '', /missing file/);
    assert.match(reports[1]?.errors.join(' ') ?? '', /year number/);
    assert.match(reports[1]?.warnings.join(' ') ?? '', /draft/);
    assert.match(reports[2]?.errors.join(' ') ?? '', /year number/);
    assert.match(reports[2]?.errors.join(' ') ?? '', /bad price/);
    assert.match(reports[2]?.errors.join(' ') ?? '', /oversized file/);
    assert.match(errorsToCsv(reports), /PS-2/);
    assert.deepEqual(pendingSkus(reports, new Set()), []);
  });

  it('rejects a manifest whose headers are wrong', () => {
    const parsed = parseManifest('sku,title\nPS-1,Hello\n');
    assert.match(parsed.headerError, /headers/);
  });

  it('resumes by skipping SKUs that already finished', () => {
    const parsed = parseManifest(SAMPLE_MANIFEST);
    const reports = reportRows(parsed.rows, filesFor(SAMPLE_MANIFEST), new Set());
    assert.deepEqual(pendingSkus(reports, new Set(['PS-4MA1-H-P1'])), ['PS-4BI1-F-N1']);
  });
});
