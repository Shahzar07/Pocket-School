import type { Metadata } from 'next';
import { AdminDesk } from '@/components/admin/desk';

export const metadata: Metadata = {
  title: 'Admin desk preview',
  robots: { index: false, follow: false },
};

type View = 'home' | 'queues' | 'platform' | 'pulse';

export default async function AdminDeskPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const view: View = params.view === 'queues' || params.view === 'platform' || params.view === 'pulse' ? params.view : 'home';
  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-[#f4f7f8] p-3 sm:p-6">
      <AdminDesk view={view} />
    </main>
  );
}
