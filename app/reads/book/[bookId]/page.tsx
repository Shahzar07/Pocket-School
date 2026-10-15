import type { Metadata } from 'next';
import { BookDetail } from '@/components/reads/detail-view';
import { publishedBooks } from '@/lib/reads/seed';

export const metadata: Metadata = { title: 'Book · Poket Reads' };
export const revalidate = 86400;

export function generateStaticParams() {
  return publishedBooks().map(book => ({ bookId: book.id }));
}

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <BookDetail bookId={bookId} />;
}
