import type { Metadata } from 'next';
import { StudioView } from '@/components/reads/studio-view';
import { PublicToolShell } from '@/components/studio/tool-shell';

export const metadata: Metadata = { title: 'Book Studio · Poket Reads' };

export default function StudioPage() {
  return (
    <PublicToolShell>
      <StudioView />
    </PublicToolShell>
  );
}
