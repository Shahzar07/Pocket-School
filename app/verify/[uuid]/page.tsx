import type { Metadata } from 'next';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { isStudentToken } from '@/lib/student-id/model';
import { verifyCardToken } from '@/lib/student-id/server';
import { VerifyFace } from '@/components/student-id/verify-face';
import { CertificateVerify } from './certificate-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata({ params }: { params: Promise<{ uuid: string }> }): Promise<Metadata> {
  const { uuid } = await params;
  if (!isStudentToken(uuid)) return { title: 'Verify a certificate' };
  return { title: 'Poket School verification', robots: { index: false, follow: false } };
}

export default async function VerifyPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  if (!isStudentToken(uuid)) return <CertificateVerify initialId={uuid} />;
  const face = isAdminConfigured() ? await verifyCardToken(uuid).catch(() => null) : null;
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-12">
      {face ? <VerifyFace face={face} /> : (
        <p className="mx-auto max-w-md text-center text-sm text-[#203337]">This student ID is not active. Ask the student to refresh their card.</p>
      )}
    </main>
  );
}
