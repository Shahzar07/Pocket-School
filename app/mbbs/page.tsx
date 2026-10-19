import type { Metadata } from 'next';
import { ProductView } from '@/components/marketing/product-view';
import { pageBySlug } from '@/lib/marketing/pages';

const page = pageBySlug('mbbs');

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.lede,
};

export default function Page() {
  return <ProductView page={page} />;
}
