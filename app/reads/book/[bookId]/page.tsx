import type { Metadata } from 'next';
import { BookDetail } from '@/components/reads/detail-view';

export const metadata: Metadata = { title: 'Book · Poket Reads' };

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <BookDetail bookId={bookId} />;
}
