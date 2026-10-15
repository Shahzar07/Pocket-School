import { cleanupMarkdown, htmlToMarkdown, importWarnings, splitByHeadings } from './markdown';
import type { ImportResult } from './types';

const LOCAL = ['.md', '.txt', '.html', '.htm'];

/** Paste or a local text file stays in the browser. Office, PDF, and EPUB go to the import route. */
export async function importFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (LOCAL.some(ext => name.endsWith(ext))) {
    const text = await file.text();
    const markdown = name.endsWith('.html') || name.endsWith('.htm') ? htmlToMarkdown(text) : cleanupMarkdown(text);
    return resultFromMarkdown(markdown, file.name);
  }
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/content/import', { method: 'POST', body });
  const data = await res.json().catch(() => ({})) as Partial<ImportResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || 'That file could not be read.');
  return {
    blocks: data.blocks ?? [],
    warnings: data.warnings ?? [],
    sourceName: data.sourceName || file.name,
  };
}

export function resultFromMarkdown(markdown: string, sourceName?: string): ImportResult {
  const blocks = splitByHeadings(markdown);
  return { blocks, warnings: importWarnings(blocks), sourceName };
}

export function resultFromHtml(html: string, sourceName?: string): ImportResult {
  return resultFromMarkdown(htmlToMarkdown(html), sourceName);
}
