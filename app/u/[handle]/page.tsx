'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { WallScreen } from '@/components/wall/wall-screen';

export default function ProfileWallPage() {
  const params = useParams<{ handle: string }>();
  const handle = typeof params?.handle === 'string' ? params.handle : '';
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <header className="flex h-14 items-center justify-between border-b border-[#e5ebf2] bg-white px-4">
        <Link href="/" className="font-heading text-xl text-[#11131b]">Poket School</Link>
        <Link href="/dashboard/community" className="text-sm font-semibold text-[#096ab7]">School wall</Link>
      </header>
      <WallScreen profileHandle={handle} />
    </main>
  );
}
