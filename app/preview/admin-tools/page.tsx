import type { Metadata } from 'next';
import { CertificateDesigner } from '@/components/certificates/designer';
import { SafeLineBanner } from '@/components/safety/safeline-banner';
import { builtinDesigns } from '@/lib/certificates/design';

export const metadata: Metadata = {
  title: 'Admin tools preview',
  robots: { index: false, follow: false },
};

export default async function AdminToolsPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const certificates = params.view === 'certificates';
  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-[#f4f7f8] p-4 text-[#203337] dark:bg-[#0B1417] dark:text-[#E8F4F6] sm:p-6">
      {certificates ? (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83] dark:text-[#3FE0D0]">Admin</p>
          <h1 className="mt-2 font-heading text-4xl text-[#203337] dark:text-[#E8F4F6]">Certificates</h1>
          <div className="mt-6">
            <CertificateDesigner initial={builtinDesigns()} canEditDefault preview />
          </div>
        </>
      ) : (
        <div className="space-y-5">
          <header className="rounded-[24px] bg-[#203337] px-5 py-6 text-white">
            <p className="text-sm font-medium">Admin desk</p>
            <h1 className="font-heading text-4xl tracking-tight">Harry</h1>
            <p className="mt-1 text-sm">Super admin. The whole platform.</p>
          </header>
          <SafeLineBanner snapshot={{ show: true, count: 2, oldestLabel: '14 min left', href: '/dashboard/admin/hotline' }} />
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] bg-white p-4 text-[#203337]"><p className="text-sm">Open queues</p><p className="font-heading text-3xl">3</p></div>
            <div className="rounded-[18px] bg-white p-4 text-[#203337]"><p className="text-sm">Safety Desk</p><p className="font-heading text-3xl">2</p></div>
            <div className="rounded-[18px] bg-white p-4 text-[#203337]"><p className="text-sm">Review accounts</p><p className="font-heading text-3xl">12</p></div>
          </section>
        </div>
      )}
    </main>
  );
}
