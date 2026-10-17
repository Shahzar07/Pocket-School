/**
 * DOCX export for a composed CV. The bytes are a real Office Open XML zip.
 */

import JSZip from 'jszip';
import { cvPlainLines, type ComposedCv } from './cv-builder';

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DOCX_FONT = { sans: 'Calibri', serif: 'Times New Roman', mono: 'Consolas' } as const;

const PAGE_TWIPS = {
  A4: { w: 11906, h: 16838 },
  Letter: { w: 12240, h: 15840 },
} as const;

function paragraph(text: string, font: string, size: number, bold: boolean, color: string): string {
  return `<w:p><w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/><w:color w:val="${color}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

export async function cvDocx(doc: ComposedCv): Promise<Uint8Array> {
  const font = DOCX_FONT[doc.theme.font];
  const accent = doc.theme.accent.replace('#', '');
  const lines = cvPlainLines(doc);
  const paragraphs = [
    paragraph(doc.theme.photo ? `${doc.initials}  ${doc.name}` : doc.name, font, doc.theme.compact ? 28 : 32, true, accent),
    ...lines.slice(1).map((line) => paragraph(line, font, doc.theme.compact ? 16 : 20, false, '1A3C34')),
  ];
  const page = PAGE_TWIPS[doc.pageSize];
  const cols = doc.theme.layout === 'two' ? '<w:cols w:num="2" w:space="360"/>' : '<w:cols w:num="1"/>';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs.join('')}
    <w:sectPr><w:pgSz w:w="${page.w}" w:h="${page.h}"/>${cols}</w:sectPr>
  </w:body>
</w:document>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file('word/document.xml', document);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  return zip.generateAsync({ type: 'uint8array' });
}
