'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

interface CredentialView {
  signature: 'valid' | 'invalid' | 'missing';
  standing: string;
  expiresAt: string | null;
  reason: string;
  linkedInUrl: string;
  shares: { copy: string; linkedin: string; whatsapp: string; email: string };
  imageUrl: string;
  issuerUrl: string;
  credential: Record<string, unknown> | null;
}

export function CredentialPanel({ id }: { id: string }) {
  const [view, setView] = useState<CredentialView | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/credentials/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setMissing(true);
          return;
        }
        const data = await res.json() as CredentialView;
        if (!cancelled) setView(data);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (missing) {
    return <p className="text-sm text-center text-[#526066]">The signed credential is published when the server account is configured.</p>;
  }
  if (!view) return <div className="h-24 rounded-3xl bg-white/70 animate-pulse" />;

  const copy = async () => {
    await navigator.clipboard.writeText(view.shares.copy);
    toast.success('Verification link copied.');
  };

  return (
    <section className="rounded-3xl border border-[#DADCE0] bg-white p-5 space-y-3">
      <h2 className="font-heading text-2xl text-[#1c2b30]">Open Badge</h2>
      <p className="text-sm text-[#526066]">
        Signature {view.signature}. Standing {view.standing}.
        {view.expiresAt ? ` Expires ${new Date(view.expiresAt).toLocaleDateString('en-GB')}.` : ' No expiry date.'}
        {view.reason ? ` ${view.reason}` : ''}
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <a className="underline" href={view.linkedInUrl} target="_blank" rel="noreferrer">Add to LinkedIn</a>
        <a className="underline" href={view.shares.linkedin} target="_blank" rel="noreferrer">Share on LinkedIn</a>
        <a className="underline" href={view.shares.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="underline" href={view.shares.email}>Email</a>
        <button type="button" className="underline" onClick={() => void copy()}>Copy link</button>
        <a className="underline" href={view.imageUrl}>Download badge</a>
        <Link className="underline" href={view.issuerUrl}>Issuer</Link>
      </div>
      {view.credential ? (
        <details>
          <summary className="text-sm font-semibold cursor-pointer">Signed JSON-LD</summary>
          <pre className="mt-2 text-[11px] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(view.credential, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  );
}
