import type { Metadata } from 'next';
import { Reader } from '@/components/reads/reader-view';

export const metadata: Metadata = { title: 'Reader · Poket Reads' };

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
