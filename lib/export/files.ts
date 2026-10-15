/**
 * Server-side lesson exports. Every file carries the Poket School wordmark
 * and the PoketSchool.Ai copyright notice.
 */
import JSZip from 'jszip';
import { mindmapSvg, parseBuzan } from '../mindmap';
import { copyrightNotice, WORDMARK } from './notice';
import { assetLines, slidePages, type ExportAsset, type ExportFormat } from './payload';

export interface BuiltFile {
  bytes: Buffer;
  contentType: string;
  filename: string;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fileSlug(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return slug || 'poket-school';
}

function pdfEscape(value: string): string {
  let out = '';
  for (const ch of value) {
    if (ch === '©') out += '\\251';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '(') out += '\\(';
    else if (ch === ')') out += '\\)';
    else if (ch >= ' ' && ch <= '~') out += ch;
    else out += ' ';
  }
  return out;
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function pdfBytes(title: string, lines: string[], notice: string): Buffer {
  const wrapped = lines.flatMap(line => wrap(line, 90));
  const perPage = 42;
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(wrapped.length, 1); i += perPage) {
    pages.push(wrapped.slice(i, i + perPage));
  }
  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 3;
  const fontId = 3;
  nextId = 4;
  const contents: { id: number; body: string }[] = [];
  for (const page of pages) {
    const id = nextId++;
    const commands = [
      '0.14 0.53 0.64 rg',
      '48 742 14 14 re f',
      '0.1 0.12 0.16 rg',
      'BT /F1 16 Tf 70 746 Td (Poket School) Tj ET',
      '0.35 0.38 0.42 rg',
      `BT /F1 11 Tf 48 720 Td (${pdfEscape(title)}) Tj ET`,
      '0.12 0.14 0.16 rg',
    ];
    page.forEach((line, index) => {
      const y = 690 - index * 15;
      commands.push(`BT /F1 11 Tf 48 ${y} Td (${pdfEscape(line)}) Tj ET`);
    });
    commands.push('0.45 0.48 0.52 rg');
    commands.push(`BT /F1 8 Tf 48 28 Td (${pdfEscape(`${WORDMARK}  ${notice}`)}) Tj ET`);
    contents.push({ id, body: commands.join('\n') });
    pageIds.push(nextId++);
  }
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  const kids = pageIds.map(id => `${id} 0 R`).join(' ');
  objects.push(`2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >> endobj`);
  objects.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  contents.forEach((item, index) => {
    objects.push(`${item.id} 0 obj << /Length ${Buffer.byteLength(item.body)} >> stream\n${item.body}\nendstream endobj`);
    const pageId = pageIds[index];
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${item.id} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >> endobj`);
  });
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${object}\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

async function docxBytes(title: string, lines: string[], notice: string): Promise<Buffer> {
  const paragraphs = [
    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${xml(WORDMARK)}</w:t></w:r></w:p>`,
    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${xml(title)}</w:t></w:r></w:p>`,
    ...lines.map(line => `<w:p><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`),
  ].join('');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${paragraphs}
    <w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/></w:sectPr>
  </w:body>
</w:document>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t>${xml(`${WORDMARK}  ${notice}`)}</w:t></w:r></w:p>
</w:ftr>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', types);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', document);
  zip.file('word/footer1.xml', footer);
  zip.file('word/_rels/document.xml.rels', docRels);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function slideXml(title: string, bullets: string[], notice: string, index: number): string {
  const bulletText = bullets.map((bullet, row) =>
    `<a:p><a:r><a:rPr lang="en-GB" sz="2000"/><a:t>${xml(bullet)}</a:t></a:r></a:p>`,
  ).join('') || '<a:p><a:endParaRPr lang="en-GB"/></a:p>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title ${index}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="274320"/><a:ext cx="8229600" cy="822960"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB" sz="3200" b="1"/><a:t>${xml(title)}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body ${index}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="1280160"/><a:ext cx="8229600" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>${bulletText}</p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Footer ${index}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="6400800"/><a:ext cx="8229600" cy="365760"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB" sz="1000"/><a:t>${xml(`${WORDMARK}  ${notice}`)}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

async function pptxBytes(title: string, content: unknown, notice: string): Promise<Buffer> {
  const pages = slidePages(content);
  const slides = pages.length ? pages : [{ title, bullets: [] }];
  const slideRels = slides.map((_, index) =>
    `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
  ).join('');
  const sldId = slides.map((_, index) =>
    `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`,
  ).join('');
  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${sldId}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
  const presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slideRels}
</Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
  const overrides = slides.map((_, index) =>
    `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join('');
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${overrides}
</Types>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', types);
  zip.file('_rels/.rels', rootRels);
  zip.file('ppt/presentation.xml', presentation);
  zip.file('ppt/_rels/presentation.xml.rels', presRels);
  slides.forEach((slide, index) => {
    zip.file(`ppt/slides/slide${index + 1}.xml`, slideXml(slide.title || title, slide.bullets, notice, index + 1));
  });
  return zip.generateAsync({ type: 'nodebuffer' });
}

function cardSvg(title: string, lines: string[], notice: string): string {
  const body = lines.slice(0, 28).map((line, index) =>
    `<text x="48" y="${150 + index * 28}" font-size="18" font-family="sans-serif" fill="#1f2933">${xml(line.slice(0, 90))}</text>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
  <rect width="100%" height="100%" fill="#f7f4ee"/>
  <circle cx="48" cy="56" r="16" fill="#2786A4"/>
  <text x="76" y="62" font-size="22" font-family="sans-serif" font-weight="700" fill="#243037">${xml(WORDMARK)}</text>
  <text x="48" y="110" font-size="28" font-family="sans-serif" font-weight="700" fill="#243037">${xml(title.slice(0, 60))}</text>
  ${body}
  <text x="48" y="1560" font-size="14" font-family="sans-serif" fill="#6b7280">${xml(`${WORDMARK}  ${notice}`)}</text>
</svg>`;
}

function footerSvg(width: number, notice: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="56">
  <rect width="100%" height="100%" fill="#f7f4ee"/>
  <circle cx="28" cy="28" r="12" fill="#2786A4"/>
  <text x="48" y="33" font-size="14" font-family="sans-serif" fill="#374151">${xml(`${WORDMARK}  ${notice}`)}</text>
</svg>`;
}

async function rasterBytes(svg: string, format: 'png' | 'jpg', notice: string): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const base = sharp(Buffer.from(svg));
  const meta = await base.metadata();
  const width = meta.width ?? 1200;
  const rendered = await sharp(Buffer.from(svg)).png().toBuffer();
  const withFooter = await sharp(rendered)
    .extend({ bottom: 56, background: '#f7f4ee' })
    .composite([{ input: Buffer.from(footerSvg(width, notice)), gravity: 'south' }])
    .toBuffer();
  if (format === 'jpg') return sharp(withFooter).jpeg({ quality: 86 }).toBuffer();
  return sharp(withFooter).png().toBuffer();
}

function safeImageUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host === 'metadata.google.internal') return null;
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

async function imageBytes(url: string, format: 'png' | 'jpg', notice: string): Promise<Buffer> {
  const target = safeImageUrl(url);
  if (!target) throw new Error('Image downloads need an https address.');
  const response = await fetch(target, { redirect: 'follow' });
  if (!response.ok) throw new Error('The image could not be fetched.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8_000_000) throw new Error('That image is too large to export.');
  const sharp = (await import('sharp')).default;
  const meta = await sharp(bytes).metadata();
  const width = meta.width ?? 800;
  const composited = await sharp(bytes)
    .extend({ bottom: 56, background: '#f7f4ee' })
    .composite([{ input: Buffer.from(footerSvg(width, notice)), gravity: 'south' }])
    .toBuffer();
  if (format === 'jpg') return sharp(composited).jpeg({ quality: 86 }).toBuffer();
  return sharp(composited).png().toBuffer();
}

const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
};

export async function buildExport(input: {
  asset: ExportAsset;
  format: ExportFormat;
  title: string;
  content: unknown;
  answerKey: boolean;
}): Promise<BuiltFile> {
  const notice = copyrightNotice();
  const title = input.title.trim() || 'Poket School';
  const slug = fileSlug(title);
  const filename = `${slug}.${input.format === 'jpg' ? 'jpg' : input.format}`;

  if (input.format === 'pptx') {
    if (input.asset !== 'slides') throw new Error('PowerPoint export is for slides.');
    return { bytes: await pptxBytes(title, input.content, notice), contentType: MIME.pptx, filename };
  }

  if (input.format === 'png' || input.format === 'jpg') {
    if (input.asset === 'image') {
      const record = input.content && typeof input.content === 'object' ? input.content as { url?: string } : null;
      const bytes = await imageBytes(String(record?.url ?? ''), input.format, notice);
      return { bytes, contentType: MIME[input.format], filename };
    }
    if (input.asset === 'mindmap' && typeof input.content === 'string') {
      const map = parseBuzan(input.content);
      if (!map) throw new Error('This mind map needs regenerating.');
      const bytes = await rasterBytes(mindmapSvg(map), input.format, notice);
      return { bytes, contentType: MIME[input.format], filename };
    }
    if (input.asset === 'infographic' && typeof input.content === 'string') {
      const bytes = await rasterBytes(cardSvg(title, input.content.split('\n'), notice), input.format, notice);
      return { bytes, contentType: MIME[input.format], filename };
    }
    throw new Error('PNG and JPG exports are for images, infographics, and mind maps.');
  }

  const lines = assetLines(input.asset, input.content, input.answerKey);
  if (input.asset === 'mindmap' && lines.length === 0) throw new Error('This mind map needs regenerating.');
  if (input.format === 'pdf') {
    return { bytes: pdfBytes(title, lines, notice), contentType: MIME.pdf, filename };
  }
  return { bytes: await docxBytes(title, lines, notice), contentType: MIME.docx, filename };
}
