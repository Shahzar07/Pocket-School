'use client';

import { IssuanceDesk } from '@/components/credentials/issuance-desk';

export default function AdminCertificatesPage() {
  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Admin</p>
        <h1 className="text-4xl font-semibold mt-2">Certificates</h1>
        <p className="text-muted-foreground mt-2">
          Design the Open Badge and issue it to a school list. Each badge is a signed credential with a public verify page.
        </p>
      </header>
      <IssuanceDesk mode="admin" />
    </div>
  );
}
