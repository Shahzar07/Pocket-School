import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/article';

export const metadata: Metadata = { title: 'Terms' };

export default function Page() {
  return <LegalArticle id="terms" />;
}
