import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { issuerDocument } from '@/lib/server/badge-issue';
import { ISSUER_SLUG } from '@/lib/credentials/badge-model';

export const metadata: Metadata = {
  title: 'Issuer profile',
  description: 'Poket School publishes the public key used to sign Open Badges 3.0 module certificates.',
};

export const dynamic = 'force-dynamic';

export default async function IssuerPage({ params }: { params: Promise<{ issuerId: string }> }) {
  const { issuerId } = await params;
  if (issuerId !== ISSUER_SLUG && issuerId !== 'poket-school') notFound();
  const profile = await issuerDocument('https://poketschool.ai');
  const methods = Array.isArray(profile.verificationMethod) ? profile.verificationMethod as { publicKeyMultibase?: string }[] : [];
  const key = methods[0]?.publicKeyMultibase ?? '';
  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Open Badges 3.0</p>
        <h1 className="font-heading text-4xl">Poket School</h1>
        <p className="text-muted-foreground">
          Poket School is the issuer of module certificates. A verifier checks the signature against the public key below, then reads live status for expiry and revocation.
        </p>
        <dl className="rounded-3xl border border-border divide-y divide-border">
          <div className="px-4 py-3 text-sm flex justify-between gap-4"><dt>Email</dt><dd>hello@poketschool.ai</dd></div>
          <div className="px-4 py-3 text-sm flex justify-between gap-4"><dt>Profile</dt><dd className="font-mono text-xs break-all">{String(profile.id)}</dd></div>
          <div className="px-4 py-3 text-sm"><dt className="mb-1">Public key</dt><dd className="font-mono text-xs break-all">{key || 'The signing key is created when the server account is configured.'}</dd></div>
        </dl>
        <p className="text-sm">
          <Link className="underline" href="/api/credentials/issuer">Issuer JSON-LD</Link>
          {' · '}
          <Link className="underline" href="/verify/new">Verify a certificate</Link>
        </p>
      </div>
    </main>
  );
}
