import type { Metadata } from 'next';
import { VhsArchive } from '@/components/reads/vhs-archive';

export const metadata: Metadata = {
  title: 'Leon Vasari — Film Archive',
  description: 'A curved shelf of twelve films, 1958 to 1989.',
  robots: { index: false, follow: false },
};

export default function ArchivePage() {
  return <VhsArchive backHref="/reads" />;
}
