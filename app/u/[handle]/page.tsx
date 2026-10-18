'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { WallScreen } from '@/components/wall/wall-screen';

export default function ProfileWallPage() {
  const params = useParams<{ handle: string }>();
  const handle = typeof params?.handle === 'string' ? params.handle : '';
  return (
    <main className="min-h-screen bg-[#F4F6F6]">
      <header className="flex h-14 items-center justify-between border-b border-[#E7EDED] bg-white px-4">
        <Link href="/" className="font-heading text-xl text-[#203337]">Poket School</Link>
        <Link href="/dashboard/community" className="text-sm font-semibold text-[#1E6A83]">School wall</Link>
      </header>
      <WallScreen profileHandle={handle} />
    </main>
  );
}
