'use client';

import { IssuanceDesk } from '@/components/credentials/issuance-desk';

export default function SchoolCertificatesPage() {
  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">School</p>
        <h1 className="text-4xl font-semibold mt-2">Class certificates</h1>
        <p className="text-muted-foreground mt-2">
          Issue Poket School badges for students in this school who have finished a module.
        </p>
      </header>
      <IssuanceDesk mode="school" />
    </div>
  );
}
