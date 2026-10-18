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
  const sample = uuid === 'ps1.preview.signature' || uuid === 'ps1.sample.preview';
  const face = sample
    ? {
      firstName: 'Amina',
      label: 'Verified Poket School student' as const,
      state: 'active' as const,
      validUntil: Date.UTC(2099, 0, 1),
      ageBand: '<18' as const,
      showPhoto: false,
      avatarUrl: '',
      initial: 'A',
    }
    : isAdminConfigured() ? await verifyCardToken(uuid).catch(() => null) : null;
  return (
    <main className="min-h-screen bg-[#F4F6F6] px-4 py-12">
      {face ? <VerifyFace face={face} /> : (
        <p className="mx-auto max-w-md text-center text-sm text-[#203337]">This student ID is not active. Ask the student to refresh their card.</p>
      )}
    </main>
  );
}
