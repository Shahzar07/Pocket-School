import { describe, expect, it } from 'vitest';
import {
  buildCertificatePdf,
  certificateDocumentHtml,
  certificateKey,
  certificateStudentName,
  moduleIsComplete,
  publishedProgress,
} from './certificates';

describe('module completion', () => {
  const published = ['pub-a', 'pub-c'];

  it('ignores drafts and unknown ids when deciding a module is complete', () => {
    expect(moduleIsComplete(published, ['pub-a', 'draft-b'])).toBe(false);
    expect(moduleIsComplete(published, ['pub-a', 'pub-c', 'draft-b', 'ghost'])).toBe(true);
    expect(moduleIsComplete([], ['draft-b'])).toBe(false);
  });

  it('calculates progress from published lessons only', () => {
    expect(publishedProgress(['draft-b', 'ghost'], published)).toBe(0);
    expect(publishedProgress(['pub-a', 'draft-b', 'ghost'], published)).toBe(50);
    expect(publishedProgress(['pub-a', 'pub-c', 'ghost'], published)).toBe(100);
    expect(publishedProgress(['pub-a'], [])).toBe(0);
  });

  it('keeps one certificate key per student, course and module', () => {
    expect(certificateKey('stu', 'course', 'mod')).toBe('stu__course__mod');
    expect(certificateStudentName('  Aisha   Rahman ')).toBe('Aisha Rahman');
    expect(certificateStudentName('')).toBe('Student');
  });
});

describe('certificate document', () => {
  const face = {
    id: '11111111-2222-4333-8444-555555555555',
    studentName: 'Aisha <script>',
    courseTitle: 'Biology',
    moduleTitle: 'Cells and organisation',
    issuedAt: '2026-10-15T12:00:00.000Z',
    issuedByName: 'Poket School',
  };

  it('builds a PDF that names the student, module and Poket School', () => {
    const text = new TextDecoder().decode(buildCertificatePdf(face));
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('POKET SCHOOL');
    expect(text).toContain('Aisha <script>');
    expect(text).toContain('Cells and organisation');
    expect(text).toContain('Biology');
    expect(text).toContain(face.id);
    expect(text).toContain(`/verify/${face.id}`);
    expect(text).not.toContain('Pocket');
  });

  it('escapes the print view so a name cannot inject markup', () => {
    const html = certificateDocumentHtml(face);
    expect(html).toContain('Poket School');
    expect(html).toContain('Aisha &lt;script&gt;');
    expect(html).not.toContain('<script>Aisha');
    expect(html).toContain(face.id);
    expect(html).toContain('Cells and organisation');
    expect(html).toContain('not official academic qualifications');
  });
});
