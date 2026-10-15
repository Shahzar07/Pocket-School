import { NextResponse } from 'next/server';
import { parseHTML } from 'linkedom';
import { htmlToMarkdown } from '@/components/editor/markdown';
import { resultFromMarkdown } from '@/components/editor/import-file';

export const runtime = 'nodejs';

const MAX_BYTES = 8_000_000;

/**
 * Read a manuscript the browser should not parse itself.
 * .md and .txt are handled in the client. This route accepts .docx, .pdf, and .epub.
 * Nothing is stored.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Files need to be under 8 MB.' }, { status: 413 });
  const name = file.name.toLowerCase();
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    let markdown = '';
    if (name.endsWith('.docx')) markdown = await docxToMarkdown(bytes);
    else if (name.endsWith('.pdf')) markdown = await pdfToMarkdown(bytes);
    else if (name.endsWith('.epub')) markdown = await epubToMarkdown(bytes);
    else if (name.endsWith('.md') || name.endsWith('.txt')) markdown = bytes.toString('utf8');
    else if (name.endsWith('.html') || name.endsWith('.htm')) markdown = htmlFrom(bytes.toString('utf8'));
    else return NextResponse.json({ error: 'Use a .docx, .md, .txt, .pdf, or .epub file.' }, { status: 400 });
    return NextResponse.json(resultFromMarkdown(markdown, file.name));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'That file could not be read.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

async function docxToMarkdown(bytes: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml({ buffer: bytes });
  return htmlFrom(result.value);
}

async function pdfToMarkdown(bytes: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const extracted = await extractText(pdf, { mergePages: true });
  const text = extracted.text;
  if (!text.trim()) throw new Error('This PDF has no extractable text. Paste the text, or export it as .docx.');
  return text;
}

async function epubToMarkdown(bytes: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(bytes);
  const container = await zip.file('META-INF/container.xml')?.async('string');
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error('This EPUB has no package file.');
  const opf = await zip.file(opfPath)?.async('string');
  if (!opf) throw new Error('This EPUB package could not be read.');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const hrefs = [...opf.matchAll(/<item\b[^>]*>/g)]
    .map(match => match[0])
    .filter(tag => tag.includes('application/xhtml+xml'))
    .map(tag => tag.match(/\bhref="([^"]+)"/)?.[1])
    .filter((href): href is string => Boolean(href));
  if (hrefs.length === 0) throw new Error('This EPUB has no chapters.');
  const parts: string[] = [];
  for (const href of hrefs) {
    const file = zip.file(decodeURIComponent(`${base}${href}`)) ?? zip.file(`${base}${href}`);
    const xhtml = await file?.async('string');
    if (xhtml) parts.push(htmlFrom(xhtml));
  }
  return parts.join('\n\n');
}

function htmlFrom(html: string): string {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  return htmlToMarkdown('', document.body as unknown as Parameters<typeof htmlToMarkdown>[1]);
}
