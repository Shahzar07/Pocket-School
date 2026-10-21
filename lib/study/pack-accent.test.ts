import assert from 'node:assert/strict';
import test from 'node:test';
import { EXAM_PACKS } from './exam-packs';
import { PACK_LABEL, accentIsOnBrand, packFamily, packStrip } from './pack-accent';

test('exam pack strips stay inside the brand palette', () => {
  assert.equal(packFamily('National syllabus'), 'national');
  assert.equal(packFamily('International'), 'international');
  assert.equal(packFamily('Diploma'), 'diploma');
  assert.equal(packFamily('School syllabus'), 'national');
  assert.equal(packStrip('National syllabus'), '#1E6A83');
  assert.equal(packStrip('Diploma'), '#3FE0D0');
  assert.match(packStrip('International'), /^linear-gradient\(135deg, #1E6A83 0%, #2786A4 50%, #6FBBCE 100%\)$/);
  assert.equal(PACK_LABEL.light, '#1E6A83');
  assert.equal(PACK_LABEL.dark, '#3FE0D0');
  for (const pack of EXAM_PACKS) {
    assert.equal(accentIsOnBrand(pack.accent), true, pack.id);
    assert.equal(pack.accent, packStrip(pack.board), pack.id);
  }
});
