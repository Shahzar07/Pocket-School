/** Split chapter prose into pages without cutting a paragraph in half. */
export function paginateChapter(markdown: string, wordsPerPage = 220): string[] {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [''];

  const pages: string[] = [];
  let bucket: string[] = [];
  let words = 0;

  const count = (s: string) => s.split(/\s+/).filter(Boolean).length;

  for (const paragraph of paragraphs) {
    if (paragraph.startsWith('!full[')) {
      if (bucket.length) {
        pages.push(bucket.join('\n\n'));
        bucket = [];
        words = 0;
      }
      pages.push(paragraph);
      continue;
    }
    const n = count(paragraph);
    if (bucket.length > 0 && words + n > wordsPerPage) {
      pages.push(bucket.join('\n\n'));
      bucket = [];
      words = 0;
    }
    bucket.push(paragraph);
    words += n;
  }
  if (bucket.length) pages.push(bucket.join('\n\n'));
  return pages;
}

export function chapterProgress(chapterIndex: number, pageIndex: number, chapterCount: number, pageCount: number): number {
  if (chapterCount <= 0) return 0;
  const chapterShare = 1 / chapterCount;
  const pageShare = pageCount > 0 ? pageIndex / pageCount : 0;
  return Math.round((chapterIndex * chapterShare + pageShare * chapterShare) * 100);
}

export function sentencesOf(text: string): string[] {
  const parts = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [text];
}
