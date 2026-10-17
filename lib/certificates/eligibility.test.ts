import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allUnitsPassed,
  certificateEligible,
  certificateLevelName,
  courseCertificatePassMark,
  isFinalAssessment,
} from './eligibility';
import { courseCertificateLines, courseCertificatePdf } from './template';

describe('course certificate eligibility', () => {
  const units = [
    { id: 'u1', hasUnitTest: true },
    { id: 'u2', hasUnitTest: true },
    { id: 'notes', hasUnitTest: false },
  ];

  it('uses the course pass mark, or 70 when the course has none', () => {
    assert.equal(courseCertificatePassMark(null), 70);
    assert.equal(courseCertificatePassMark({ unitTestPassMark: 80 }), 80);
  });

  it('recognises a final assessment and ignores a plain unit test', () => {
    assert.equal(isFinalAssessment({ finalAssessment: true }), true);
    assert.equal(isFinalAssessment({ assessmentConfig: { certificateOnPass: true } }), true);
    assert.equal(isFinalAssessment({ assessmentConfig: { kind: 'mock_exam' } }), true);
    assert.equal(isFinalAssessment({ assessmentConfig: { kind: 'unit_assessment' } }), false);
    assert.equal(isFinalAssessment({}), false);
  });

  it('withholds the certificate for completion or a single unit pass', () => {
    assert.equal(certificateEligible({
      finalPassed: false,
      finalScore: 100,
      passMark: 70,
      units,
      passedUnitIds: ['u1', 'u2'],
    }), false);
    assert.equal(certificateEligible({
      finalPassed: true,
      finalScore: 90,
      passMark: 70,
      units,
      passedUnitIds: ['u1'],
    }), false);
    assert.equal(allUnitsPassed(units, ['u1']), false);
  });

  it('issues only when the final meets the pass mark and every unit test is passed', () => {
    assert.equal(certificateEligible({
      finalPassed: true,
      finalScore: 75,
      passMark: 80,
      units,
      passedUnitIds: ['u1', 'u2'],
    }), false);
    assert.equal(certificateEligible({
      finalPassed: true,
      finalScore: 80,
      passMark: 80,
      units,
      passedUnitIds: ['u1', 'u2'],
    }), true);
  });

  it('prints a level name and never a year number', () => {
    assert.equal(certificateLevelName({ yearGroup: 'Year 10' }), 'IGCSE');
    assert.equal(certificateLevelName({ level: 'A-Level' }), 'A-Level');
    assert.equal(certificateLevelName({ yearGroup: 'not a level 99' }), '');
    const lines = courseCertificateLines({
      id: 'cert-1',
      studentName: 'Aisha Rahman',
      courseTitle: 'Biology',
      level: 'IGCSE',
      issuedAt: '2026-10-17T00:00:00.000Z',
      score: 82,
    });
    assert.equal(lines.includes('Aisha Rahman'), true);
    assert.equal(lines.includes('Biology'), true);
    assert.equal(lines.includes('IGCSE'), true);
    assert.equal(lines.includes('Score  82%'), true);
    assert.equal(lines.includes('Certificate ID  cert-1'), true);
    assert.equal(lines.some((line) => /Year\s+\d/.test(line)), false);
    const pdf = new TextDecoder().decode(courseCertificatePdf({
      id: 'cert-1',
      studentName: 'Aisha Rahman',
      courseTitle: 'Biology',
      level: 'IGCSE',
      issuedAt: '2026-10-17T00:00:00.000Z',
      score: 82,
    }));
    assert.equal(pdf.startsWith('%PDF-1.4'), true);
    assert.equal(pdf.includes('IGCSE'), true);
    assert.equal(pdf.includes('cert-1'), true);
  });
});
