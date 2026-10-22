import type { Metadata } from 'next';
import { LibraryView } from '@/components/reads/library-view';

export const metadata: Metadata = { title: 'My Library · Poket Reads' };

export default function LibraryPage() {
  return <LibraryView />;
}
