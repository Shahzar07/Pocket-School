import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import jsQR from 'jsqr';
import { QRCodeSVG } from 'qrcode.react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { qrMatrix } from './certificate-qr';
import { copyrightLine } from './insights/copyright';
import {
  buildCertificatePdf,
  certificateDocumentHtml,
  certificateKey,
  certificateStatus,
  certificateStudentName,
  certificateVerifyUrl,
  moduleIsComplete,
  publishedProgress,
} from './certificates';

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      assert.equal(actual, expected);
    },
    toContain(expected: string) {
      assert.equal(String(actual).includes(expected), true, `expected to contain ${expected}`);
    },
    not: {
      toContain(expected: string) {
        assert.equal(String(actual).includes(expected), false, `expected not to contain ${expected}`);
      },
    },
  };
}

function paintRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  const shade = dark ? 0 : 255;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(height, Math.ceil(y + h));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      if (cx < x || cx >= x + w || cy < y || cy >= y + h) continue;
      const i = (py * width + px) * 4;
      data[i] = shade;
      data[i + 1] = shade;
      data[i + 2] = shade;
      data[i + 3] = 255;
    }
  }
}

function decodeSvg(svg: string): string | null {
  const box = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!box) return null;
  const scale = 8;
  const width = Math.round(Number(box[1]) * scale);
  const height = Math.round(Number(box[2]) * scale);
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  const shapes: { x: number; y: number; w: number; h: number; dark: boolean }[] = [];
  for (const rect of svg.matchAll(/<rect\b([^>]*)\/?>/g)) {
    const attrs = rect[1] ?? '';
    const num = (name: string, fallback = 0) => {
      const found = attrs.match(new RegExp(`\\b${name}="([^"]+)"`));
      return found ? Number(found[1]) : fallback;
    };
    const fill = attrs.match(/\bfill="([^"]+)"/)?.[1] ?? '#111111';
    shapes.push({ x: num('x'), y: num('y'), w: num('width'), h: num('height'), dark: fill !== '#ffffff' });
  }
  for (const path of svg.matchAll(/<path\b([^>]*)>/g)) {
    const attrs = path[1] ?? '';
    const d = attrs.match(/\bd="([^"]+)"/)?.[1] ?? '';
    const fill = attrs.match(/\bfill="([^"]+)"/)?.[1] ?? '#111111';
    const dark = fill !== '#ffffff';
    for (const part of d.matchAll(/M\s*([\d.]+)[,\s]+([\d.]+)\s*h\s*([\d.]+)\s*v\s*([\d.]+)\s*H\s*[\d.]+\s*z/gi)) {
      shapes.push({ x: Number(part[1]), y: Number(part[2]), w: Number(part[3]), h: Number(part[4]), dark });
    }
  }
  for (const shape of shapes) {
    paintRect(data, width, height, shape.x * scale, shape.y * scale, shape.w * scale, shape.h * scale, shape.dark);
  }
  return jsQR(data, width, height)?.data ?? null;
}

function decodePdfQr(pdf: string): string | null {
  const fills = [...pdf.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re f/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    w: Number(match[3]),
    h: Number(match[4]),
  }));
  const plate = fills[0];
  if (!plate) return null;
  const scale = 8;
  const width = Math.round(plate.w * scale);
  const height = Math.round(plate.h * scale);
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  for (const rect of fills.slice(1)) {
    const x = (rect.x - plate.x) * scale;
    const y = (plate.y + plate.h - rect.y - rect.h) * scale;
    paintRect(data, width, height, x, y, rect.w * scale, rect.h * scale, true);
  }
  return jsQR(data, width, height)?.data ?? null;
}

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

  it('builds a PDF that names the student, module, id and a QR code for the verification page', () => {
    const verify = certificateVerifyUrl(face.id);
    const text = new TextDecoder().decode(buildCertificatePdf(face));
    const matrix = qrMatrix(verify);
    let dark = 0;
    for (let row = 0; row < matrix.size; row += 1) {
      for (let col = 0; col < matrix.size; col += 1) {
        if (matrix.dark(row, col)) dark += 1;
      }
    }
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('POKET SCHOOL');
    expect(text).toContain('Aisha <script>');
    expect(text).toContain('Cells and organisation');
    expect(text).toContain('Biology');
    expect(text).toContain(face.id);
    expect(text).toContain(verify);
    expect(text).toContain('Status  Valid');
    expect(text).toContain('Scan to verify');
    expect(text).toContain(copyrightLine(2026).replace('©', '\\251'));
    expect(text).not.toContain('Pocket');
    // One white plate plus one filled square per dark module.
    expect(text.split(' re f').length - 1).toBe(dark + 1);
    expect(matrix.dark(0, 0)).toBe(true);
    expect(matrix.dark(0, 6)).toBe(true);
    expect(matrix.dark(1, 1)).toBe(false);
    expect(decodePdfQr(text)).toBe(verify);
    const printed = certificateDocumentHtml(face);
    const printQr = printed.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? '';
    expect(decodeSvg(printQr)).toBe(verify);
    const onScreen = renderToStaticMarkup(createElement(QRCodeSVG, {
      value: verify,
      size: 168,
      level: 'M',
      marginSize: 4,
      bgColor: '#ffffff',
      fgColor: '#111111',
      title: 'Scan to open the public verification page for this certificate',
    }));
    expect(decodeSvg(onScreen)).toBe(verify);
  });

  it('prints a revoked certificate with a QR code and an escaped name', () => {
    const html = certificateDocumentHtml({ ...face, status: 'revoked' });
    expect(html).toContain('Poket School');
    expect(html).toContain('Aisha &lt;script&gt;');
    expect(html).not.toContain('<script>Aisha');
    expect(html).toContain(face.id);
    expect(html).toContain('Cells and organisation');
    expect(html).toContain('Revoked');
    expect(html).toContain('<svg');
    expect(html).toContain(certificateVerifyUrl(face.id));
    expect(html).toContain('not official academic qualifications');
    expect(html).toContain(copyrightLine(2026));
    expect(certificateStatus('revoked')).toBe('revoked');
    expect(certificateStatus(undefined)).toBe('valid');
    const revokedPdf = new TextDecoder().decode(buildCertificatePdf({ ...face, status: 'revoked' }));
    expect(revokedPdf).toContain('Status  Revoked');
    expect(revokedPdf).toContain(face.id);
  });
});
