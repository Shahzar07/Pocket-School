export interface BookCommand {
  bookId: string;
  title: string;
  rest: string;
  matched: boolean;
}

/**
 * `/book <id or title> [instruction]`.
 * The longest matching title wins, then an exact id. An unknown token is returned unmatched.
 */
export function parseBookCommand(
  text: string,
  books: readonly { id: string; title: string }[],
): BookCommand | null {
  const trimmed = text.trim();
  if (!/^\/book\b/i.test(trimmed)) return null;
  const body = trimmed.replace(/^\/book\s*/i, '').trim();
  if (!body) return null;

  const byTitle = [...books].sort((a, b) => b.title.length - a.title.length).find(book => {
    const title = book.title.toLowerCase();
    const hay = body.toLowerCase();
    return hay === title || hay.startsWith(`${title} `);
  });
  if (byTitle) {
    const rest = body.slice(byTitle.title.length).trim();
    return { bookId: byTitle.id, title: byTitle.title, rest, matched: true };
  }

  const token = body.split(/\s+/)[0] ?? '';
  const byId = books.find(book => book.id === token);
  if (byId) {
    return { bookId: byId.id, title: byId.title, rest: body.slice(byId.id.length).trim(), matched: true };
  }
  return { bookId: token, title: token, rest: body.slice(token.length).trim(), matched: false };
}

/** Tutor and generation text that stays inside the attached book. */
export function bookSourcePrompt(
  book: { title: string; blurb: string; chapters: readonly { title: string; markdown: string }[] },
  rest: string,
): string {
  const chapter = book.chapters[0];
  const excerpt = (chapter?.markdown ?? '')
    .replace(/!(?:full)?\[[^\]]*\]\([^)]*\)/g, '')
    .slice(0, 1200);
  const ask = rest || 'Teach from this book.';
  return `Using the book "${book.title}" as the source.\n${book.blurb}\nChapter: ${chapter?.title ?? ''}\n${excerpt}\n\n${ask}`;
}
