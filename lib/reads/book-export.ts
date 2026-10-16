/**
 * EPUB and PDF downloads for the existing Book Studio.
 * The copyright line is the same one used on reports.
 * Prices on the book are not read or rewritten here.
 */

import { copyrightLine } from '@/lib/insights/copyright';
import { buildPdf } from '@/lib/insights/pdf';
import type { Book } from '@/lib/reads/types';

export function chapterPlain(markdown: string): string {
  return markdown
    .replace(/!full\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function bookDownloadLines(book: Pick<Book, 'title' | 'chapters'>): string[] {
  return [
    'By ET AI',
    '',
    ...book.chapters.flatMap(chapter => [chapter.title, chapterPlain(chapter.markdown), '']),
  ];
}

export function bookPdf(book: Pick<Book, 'title' | 'chapters'>, year = new Date().getFullYear()): Uint8Array {
  return buildPdf(book.title, bookDownloadLines(book), year);
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

/** Stored (uncompressed) zip. The EPUB mimetype entry stays first. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length + file.data.length);
    const localView = new DataView(local.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 8, 0);
    u32(localView, 14, crc);
    u32(localView, 18, file.data.length);
    u32(localView, 22, file.data.length);
    u16(localView, 26, name.length);
    local.set(name, 30);
    local.set(file.data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u32(centralView, 16, crc);
    u32(centralView, 20, file.data.length);
    u32(centralView, 24, file.data.length);
    u16(centralView, 28, name.length);
    u32(centralView, 42, offset);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 8, files.length);
  u16(endView, 10, files.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, offset);
  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function bookEpub(book: Pick<Book, 'id' | 'title' | 'chapters'>, year = new Date().getFullYear()): Uint8Array {
  const notice = copyrightLine(year);
  const chapters = book.chapters.map((chapter, index) => {
    const file = `OEBPS/chapter-${index + 1}.xhtml`;
    const body = chapterPlain(chapter.markdown);
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head><title>${xml(chapter.title)}</title></head>
<body>
<h1>${xml(chapter.title)}</h1>
<p>${xml(body)}</p>
${index === book.chapters.length - 1 ? `<p>${xml(notice)}</p>` : ''}
</body>
</html>`;
    return { id: `c${index + 1}`, file, href: `chapter-${index + 1}.xhtml`, title: chapter.title, xhtml };
  });
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">${xml(book.id)}</dc:identifier>
<dc:title>${xml(book.title)}</dc:title>
<dc:creator>ET AI</dc:creator>
<dc:language>en</dc:language>
<dc:rights>${xml(notice)}</dc:rights>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${chapters.map(chapter => `<item id="${chapter.id}" href="${chapter.href}" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine>
${chapters.map(chapter => `<itemref idref="${chapter.id}"/>`).join('\n')}
</spine>
</package>`;
  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body><nav epub:type="toc"><ol>
${chapters.map(chapter => `<li><a href="${chapter.href}">${xml(chapter.title)}</a></li>`).join('')}
</ol></nav><p>${xml(notice)}</p></body></html>`;
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
  return zipStore([
    { name: 'mimetype', data: utf8('application/epub+zip') },
    { name: 'META-INF/container.xml', data: utf8(container) },
    { name: 'OEBPS/content.opf', data: utf8(opf) },
    { name: 'OEBPS/nav.xhtml', data: utf8(nav) },
    ...chapters.map(chapter => ({ name: chapter.file, data: utf8(chapter.xhtml) })),
  ]);
}
