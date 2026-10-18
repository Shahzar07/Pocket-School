import type { Metadata } from 'next';
import { WallScreen } from '@/components/wall/wall-screen';

export const metadata: Metadata = { robots: { index: false, follow: false }, title: 'Community wall' };

export default function CommunityPreviewPage() {
  return (
    <main className="min-h-screen bg-[#F4F6F6]">
      <WallScreen />
    </main>
  );
}
