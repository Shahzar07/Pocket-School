import type { Metadata } from 'next';
import { Reader } from '@/components/reads/reader-view';
import { publishedBooks } from '@/lib/reads/seed';

export const metadata: Metadata = { title: 'Reader · Poket Reads' };
export const revalidate = 86400;

export function generateStaticParams() {
  return publishedBooks().map(book => ({ bookId: book.id }));
}

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { bookId } = await params;
  const { lang } = await searchParams;
  return <Reader bookId={bookId} initialLang={lang} />;
}
