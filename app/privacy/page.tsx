import type { Metadata } from 'next';
import { LegalArticle } from '@/components/legal/article';

export const metadata: Metadata = { title: 'Privacy' };

export default function Page() {
  return <LegalArticle id="privacy" />;
}
