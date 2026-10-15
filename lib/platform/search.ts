import { publishedBooks } from '@/lib/reads/seed';

/** Book hits for the shared search route. Public shelf search can call this too. */
export function searchBooks(query: string): { id: string; title: string; kind: 'book'; href: string; subject: string }[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return publishedBooks()
    .filter(book => `${book.title} ${book.blurb} ${book.genre} ${book.programme ?? ''}`.toLowerCase().includes(q))
    .slice(0, 5)
    .map(book => ({
      id: book.id,
      title: book.title,
      kind: 'book' as const,
      href: `/reads/book/${book.id}`,
      subject: book.genre,
    }));
}
